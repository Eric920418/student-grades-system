// 在「老師已登入的瀏覽器分頁」裡自動爬取 portalx 所有課程與名單。
// 用 chrome.scripting(world:MAIN) 直接呼叫 portalx 頁面的 GoToPage() 並讀 DOM，
// 同 IP、同 session，portalx 不會擋。只把「結果」回傳成績系統（不送 cookie）。
//
// 架構：popup 只送 START + 輪詢 chrome.storage；爬取在這裡跑、進度/結果寫 storage。
// （MV3 popup 短命，不可讓它同步等 1-3 分鐘的回應 → 否則 message port closed。）

const HOME = 'https://portalx.yzu.edu.tw/PortalSocialVB/';
const CLASSMATE = 'https://portalx.yzu.edu.tw/PortalSocialVB/TCon/ClassMate.aspx?Menu=Con';
const STORE = 'portalSync';

// 要排除的選單項目（系所/班級社群頁，非授課課程）。用整名精確比對，避免誤殺真課名。
const EXCLUDE_NAMES = ['資傳系111B', '資訊傳播學系'];

let running = false;

async function setState(s) { await chrome.storage.local.set({ [STORE]: s }); }

async function getConfig() {
  const { appUrl, token } = await chrome.storage.sync.get(['appUrl', 'token']);
  return {
    appUrl: (appUrl || 'https://student-grades-system.vercel.app').replace(/\/$/, ''),
    token: token || '',
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitComplete(tabId, timeout = 20000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(t); chrome.tabs.onUpdated.removeListener(listener); resolve(); } };
    const t = setTimeout(finish, timeout);
    function listener(id, info) { if (id === tabId && info.status === 'complete') finish(); }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function nav(tabId, url) {
  await chrome.tabs.update(tabId, { url });
  await waitComplete(tabId);
  await sleep(700);
}

async function exec(tabId, func, args) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func, args: args || [] });
  return res ? res.result : null;
}

// ── 注入 portalx 頁面(MAIN world)執行的函式 ──
function pageReadMenu() {
  return [...document.querySelectorAll('#MainLeftMenu_divMyPage td.tdLeftMenu')]
    .map((td) => {
      const m = (td.getAttribute('onclick') || '').match(/GoToPage\('([^']+)'/);
      return { pageId: m ? m[1] : null, name: (td.textContent || '').trim() };
    })
    .filter((x) => x.pageId);
}
function pageClickCourse(pageId) {
  if (typeof GoToPage === 'function') { GoToPage(pageId, 'tdPage0'); return true; }
  return false;
}
function pageReadClassMate() {
  let cosId = '', cosClass = '', semester = '';
  const cos = document.querySelector('#Cos_info table');
  if (cos) {
    for (const r of cos.querySelectorAll('tr')) {
      const c = r.querySelectorAll('td');
      if (c.length >= 5 && /^\d{3,4}$/.test((c[1].textContent || '').trim())) {
        semester = (c[1].textContent || '').trim();
        cosId = (c[2].textContent || '').trim();
        cosClass = (c[3].textContent || '').trim();
        break;
      }
    }
  }
  const man = document.querySelector('#divMenuMan');
  const isInstructor = !!man && getComputedStyle(man).display !== 'none';
  const students = [];
  for (const tr of document.querySelectorAll('#Std_info table tr')) {
    if (tr.classList.contains('title_line')) continue;
    const c = tr.querySelectorAll('td');
    if (c.length < 6) continue;
    const sid = (c[1].textContent || '').trim();
    if (!/^\d{6,}$/.test(sid)) continue;
    const nameRaw = (c[2].textContent || '').trim();
    const withdrawn = /停修/.test(nameRaw);
    const name = nameRaw.split('(')[0].replace(/\s+/g, ' ').trim();
    let email = '';
    const a = c[5].querySelector('a');
    if (a) {
      const addrs = (a.getAttribute('href') || '').replace(/^mailto:/i, '').split(';');
      email = (addrs.find((x) => /@mail\.yzu\.edu\.tw/i.test(x)) || addrs[0] || '').trim();
    }
    students.push({ studentId: sid, name, email, withdrawn });
  }
  return { cosId, cosClass, semester, isInstructor, students };
}

async function runCrawl() {
  if (running) return;
  running = true;
  try {
    const { appUrl, token } = await getConfig();
    if (!token) { await setState({ status: 'error', error: '尚未設定配對 token，請到插件「設定」填寫。' }); return; }

    await setState({ status: 'running', progress: '讀取目前 portalx 分頁…' });
    // 用「使用者目前已登入、看得到選單」的那個分頁與網址當起點，絕不導去猜測的裸首頁
    const tabs = await chrome.tabs.query({ url: 'https://portalx.yzu.edu.tw/*' });
    const tab = tabs.find((t) => t.active) || tabs[0];
    if (!tab) {
      await setState({ status: 'error', error: '找不到已開啟的 portalx 分頁，請先在 Chrome 開啟並登入 portalx，停在看得到課程選單的頁面再按同步。' });
      return;
    }
    const tabId = tab.id;
    const homeUrl = tab.url || HOME; // 你目前所在的真實已登入頁
    if (/Login\.aspx/i.test(homeUrl)) {
      await setState({ status: 'error', error: '目前分頁停在登入頁，請先登入 portalx 並進到有課程選單的頁面再按同步。' });
      return;
    }

    // 先讀目前頁的選單（不導航）；讀不到才退而導回 homeUrl 再讀一次
    let menu = await exec(tabId, pageReadMenu);
    if (!menu || !menu.length) {
      await nav(tabId, homeUrl);
      menu = await exec(tabId, pageReadMenu);
    }
    if (!menu || !menu.length) {
      await setState({ status: 'error', error: `讀不到課程選單（目前頁：${homeUrl}）。請切到看得到左側課程清單的頁面再按同步。` });
      return;
    }

    // 濾掉非授課課程（系所/班級社群頁）
    menu = menu.filter((m) => !EXCLUDE_NAMES.includes((m.name || '').trim()));

    const courses = [];
    for (let i = 0; i < menu.length; i++) {
      const { pageId, name } = menu[i];
      await setState({ status: 'running', progress: `讀取課程 ${i + 1}/${menu.length}：${name}` });
      try {
        await nav(tabId, homeUrl);
        await exec(tabId, pageClickCourse, [pageId]);
        await sleep(1500);
        await nav(tabId, CLASSMATE);
        const info = await exec(tabId, pageReadClassMate);
        let year = '', sem = '';
        if (/^\d{4}$/.test(info.semester)) { year = info.semester.slice(0, 3); sem = info.semester.slice(3); }
        courses.push({ name, cosId: info.cosId, cosClass: info.cosClass, year, semester: sem, isInstructor: info.isInstructor, students: info.students });
      } catch (e) {
        courses.push({ name, error: String((e && e.message) || e) });
      }
    }

    await setState({ status: 'running', progress: '上傳結果到成績系統…' });
    const res = await fetch(`${appUrl}/api/portal-sync/extension-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-extension-token': token },
      body: JSON.stringify({ courses }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await setState({ status: 'error', error: data.error ? `${data.error}${data.details ? '：' + data.details : ''}` : `HTTP ${res.status}` });
      return;
    }
    await setState({ status: 'done', count: courses.length, jobId: data.jobId, appUrl });
  } catch (e) {
    await setState({ status: 'error', error: String((e && e.message) || e) });
  } finally {
    running = false;
  }
}

// ── 填成績：注入成績登錄頁(MAIN world)，依學號比對填入分數（不送出）──
function pageFill(arg) {
  const { scoreMap, cfg } = arg;
  const re = new RegExp(cfg.studentIdRegex);
  const rows = [...document.querySelectorAll(cfg.rowSelector)];
  const filled = [], skipped = [], used = {};
  for (const row of rows) {
    const input = row.querySelector(cfg.scoreInput);
    if (!input) continue;
    const hay = [input.name, input.id, row.innerText].filter(Boolean).join(' ');
    const m = hay.match(re);
    if (!m) continue;
    const sid = m[0];
    if (Object.prototype.hasOwnProperty.call(scoreMap, sid)) {
      input.value = String(scoreMap[sid]);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      filled.push(sid); used[sid] = 1;
    } else {
      skipped.push(sid);
    }
  }
  const missing = Object.keys(scoreMap).filter((s) => !used[s]);
  return { filled, skipped, missing };
}

async function getCourses() {
  const { appUrl, token } = await getConfig();
  if (!token) return { ok: false, error: '尚未設定配對 token' };
  const res = await fetch(`${appUrl}/api/portal-sync/course-grade-items`, { headers: { 'x-extension-token': token } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
  return { ok: true, courses: data.courses || [] };
}

async function fillGrades(courseId, gradeItemId) {
  const { appUrl, token } = await getConfig();
  if (!token) return { ok: false, error: '尚未設定配對 token' };
  const tabs = await chrome.tabs.query({ url: 'https://portalx.yzu.edu.tw/*' });
  const tab = tabs.find((t) => t.active) || tabs[0];
  if (!tab) return { ok: false, error: '找不到 portalx 分頁，請先開著成績登錄頁。' };

  const res = await fetch(`${appUrl}/api/portal-sync/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-extension-token': token },
    body: JSON.stringify({ courseId, gradeItemId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };

  const cfg = {
    rowSelector: 'table tr',
    scoreInput: "input[type='text'], input:not([type])",
    studentIdRegex: '[A-Za-z]?\\d{6,}',
  };
  const [r] = await chrome.scripting.executeScript({
    target: { tabId: tab.id }, world: 'MAIN', func: pageFill, args: [{ scoreMap: data.scoreMap, cfg }],
  });
  const stats = r ? r.result : null;
  return { ok: true, gradeItemName: data.gradeItemName, count: data.count, stats };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'START') {
    runCrawl(); // 不等它完成；popup 改輪詢 chrome.storage
    sendResponse({ started: true }); // 同步回應，通道立刻關閉，不會 port closed
    return;
  }
  if (msg && msg.type === 'GET_COURSES') {
    getCourses().then(sendResponse).catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;
  }
  if (msg && msg.type === 'FILL') {
    fillGrades(msg.courseId, msg.gradeItemId).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;
  }
});
