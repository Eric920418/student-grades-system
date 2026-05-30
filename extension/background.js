// 在「老師已登入的瀏覽器分頁」裡自動爬取 portalx 所有課程與名單。
// 用 chrome.scripting(world:MAIN) 直接呼叫 portalx 頁面的 GoToPage() 並讀 DOM，
// 同 IP、同 session，portalx 不會擋。只把「結果」回傳成績系統（不送 cookie）。

const HOME = 'https://portalx.yzu.edu.tw/PortalSocialVB/';
const CLASSMATE = 'https://portalx.yzu.edu.tw/PortalSocialVB/TCon/ClassMate.aspx?Menu=Con';

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

// ── 以下函式會被注入 portalx 頁面(MAIN world)執行 ──
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

async function crawl() {
  const { appUrl, token } = await getConfig();
  if (!token) return { ok: false, error: '尚未設定配對 token，請先到插件「設定」填寫。' };

  // 找一個 portalx 分頁，沒有就開一個
  let [tab] = await chrome.tabs.query({ url: 'https://portalx.yzu.edu.tw/*' });
  if (!tab) {
    tab = await chrome.tabs.create({ url: HOME, active: false });
    await waitComplete(tab.id);
    await sleep(800);
  }
  const tabId = tab.id;

  await nav(tabId, HOME);
  const menu = await exec(tabId, pageReadMenu);
  if (!menu || !menu.length) {
    return { ok: false, error: '讀不到課程選單，請確認 portalx 已登入並能看到左側課程清單。' };
  }

  const courses = [];
  for (const { pageId, name } of menu) {
    try {
      await nav(tabId, HOME);
      await exec(tabId, pageClickCourse, [pageId]); // 觸發 GoToPage（設定課程 session context）
      await sleep(1500);
      await nav(tabId, CLASSMATE);
      const info = await exec(tabId, pageReadClassMate);
      let year = '', sem = '';
      if (/^\d{4}$/.test(info.semester)) { year = info.semester.slice(0, 3); sem = info.semester.slice(3); }
      courses.push({
        name, cosId: info.cosId, cosClass: info.cosClass, year, semester: sem,
        isInstructor: info.isInstructor, students: info.students,
      });
    } catch (e) {
      courses.push({ name, error: String((e && e.message) || e) });
    }
  }

  const res = await fetch(`${appUrl}/api/portal-sync/extension-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-extension-token': token },
    body: JSON.stringify({ courses }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error ? `${data.error}${data.details ? '：' + data.details : ''}` : `HTTP ${res.status}` };
  return { ok: true, count: courses.length, jobId: data.jobId, appUrl };
}

chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
  if (msg && msg.type === 'CRAWL') {
    crawl().then(sendResponse).catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true; // async
  }
});
