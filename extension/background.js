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

// 學號正規化（只用於比對，不改寫入 DB 的值）：全形數字/字母→半形、去所有空白、字母轉大寫。
// ⚠️ 與 pageFill 內部同名邏輯、src/lib/portalSync.ts 的 norm() 必須保持一致。
function normId(s) {
  return String(s)
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '')
    .toUpperCase();
}

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

// 注入：頁面是否有某元素 / 是否為授課老師（管理選單可見）
function pageHasSelector(sel) { return !!document.querySelector(sel); }
function pageReadInstructor() {
  const m = document.querySelector('#divMenuMan');
  return !!m && getComputedStyle(m).display !== 'none';
}

// 輪詢等某元素出現（取代死等 sleep），最多 timeoutMs
async function waitForSelectorInTab(tabId, selector, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (await exec(tabId, pageHasSelector, [selector])) return true; } catch {}
    await sleep(400);
  }
  return false;
}

// 撈一門課：回首頁→點課程→(課程首頁)讀老師身分→進名單頁→等表出現→讀
async function crawlOneCourse(tabId, homeUrl, pageId, name) {
  await nav(tabId, homeUrl);
  await exec(tabId, pageClickCourse, [pageId]); // 觸發 GoToPage（會導航）
  await waitComplete(tabId);
  await sleep(600);
  // 老師身分在「課程首頁」讀（名單頁沒有 #divMenuMan）
  let isInstructor = false;
  try { isInstructor = !!(await exec(tabId, pageReadInstructor)); } catch {}
  // 進名單頁，等 #Std_info 真的出現才讀（避免讀到還沒載完的空表）
  await nav(tabId, CLASSMATE);
  await waitForSelectorInTab(tabId, '#Std_info table tr', 8000);
  const info = await exec(tabId, pageReadClassMate);
  let year = '', sem = '';
  if (/^\d{4}$/.test(info.semester)) { year = info.semester.slice(0, 3); sem = info.semester.slice(3); }
  return { name, cosId: info.cosId, cosClass: info.cosClass, year, semester: sem, isInstructor, students: info.students };
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
      let rec;
      try {
        rec = await crawlOneCourse(tabId, homeUrl, pageId, name);
        if (!rec.cosId) {
          await setState({ status: 'running', progress: `重撈課程 ${i + 1}/${menu.length}：${name}` });
          rec = await crawlOneCourse(tabId, homeUrl, pageId, name); // 第一次讀到空，重撈一次
        }
      } catch (e) {
        try {
          rec = await crawlOneCourse(tabId, homeUrl, pageId, name); // 出錯也重試一次
        } catch (e2) {
          rec = { name, error: String((e2 && e2.message) || e2) };
        }
      }
      courses.push(rec);
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
// 填值演算法：與 src/lib/portalSync.ts 的 FILL_FUNCTION_SOURCE 同一套邏輯
// （同 selector、同學號正規化比對、同 dispatch input/change、找不到跳過）。
// ⚠️ 改填法請三處一起改：本檔 pageFill、portalSync.ts FILL_FUNCTION_SOURCE、
//    worker/portalUpload.mjs（已停用，保留備查）。
// pageFill 以 allFrames 注入 → 每個 frame 各跑一次、只回統計，alert 由 fillGrades 匯總後單次跳。
//
// 比對強化（修「整批找不到欄位」）：
//   1. 每列蒐集「所有」符合學號正則的候選，逐一比對 → 不會被 WebForms 控制項 id 內的數字搶走。
//   2. 兩側先正規化（全形→半形、去空白、大寫）再比 → 全形數字/空白差異不再誤判。
//   3. haystack 以 row.innerText 優先（可見學號），再看 input.name/id。
function pageFill(arg) {
  const { scoreMap, normMap, cfg } = arg;
  const reG = new RegExp(cfg.studentIdRegex, 'g');
  // 全形→半形（讓 \d 能匹配全形數字）；norm 另去空白+大寫，只用在「單一學號」token（與 normId 一致）。
  // ⚠️ 不可對整段 haystack 去空白，否則會把「序號 學號」黏成一串長數字而抓錯。
  const widen = (s) => String(s).replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  const norm = (s) => widen(s).replace(/\s+/g, '').toUpperCase();
  const rows = [...document.querySelectorAll(cfg.rowSelector)];
  const filled = [], pageIds = [];
  let rowsWithInput = 0;
  for (const row of rows) {
    const input = row.querySelector(cfg.scoreInput);
    if (!input) continue;
    rowsWithInput++;
    const hay = widen([row.innerText, input.name, input.id].filter(Boolean).join(' ')).toUpperCase();
    const cands = hay.match(reG);
    if (!cands) continue;
    let hit = null;
    for (const c of cands) {
      const key = norm(c);
      pageIds.push(key);
      if (!hit && Object.prototype.hasOwnProperty.call(normMap, key)) hit = key;
    }
    if (hit) {
      const orig = normMap[hit];
      input.value = String(scoreMap[orig]);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      filled.push(orig);
    }
  }
  return { filled, pageIds, rowsScanned: rows.length, rowsWithInput };
}

// 注入：本 frame 是否已有「含分數輸入框的列」→ 用來等 grid render 完成。
function pageProbe(cfg) {
  for (const row of document.querySelectorAll(cfg.rowSelector)) {
    if (row.querySelector(cfg.scoreInput)) return true;
  }
  return false;
}

// 注入：填完後在頂層 frame 跳「單次」防呆統計（沿用舊腳本訊息 + 診斷）。
function pageAlert(stats) {
  let msg = '✅ 已填入 ' + stats.filled.length + ' 筆成績。';
  if (stats.missing.length) {
    msg += '\n\n⚠️ 有 ' + stats.missing.length + ' 個學號在頁面上找不到對應欄位，未填入：\n' + stats.missing.join(', ');
    msg += '\n\n（掃描 ' + stats.rowsScanned + ' 列、其中 ' + stats.rowsWithInput + ' 列有輸入框、' + stats.framesScanned + ' 個 frame）';
    if (stats.pageIdsSample.length) {
      msg += '\n頁面實際抓到的學號範例：' + stats.pageIdsSample.join(', ') + '\n（若與系統學號格式明顯不同，即為格式不符）';
    } else {
      msg += '\n頁面上完全沒抓到成績輸入欄位，請確認停在成績登錄頁且表格已載入。';
    }
  }
  msg += '\n\n尚未送出，請在 portalx 頁面核對後自行按「儲存/送出」。';
  alert(msg);
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

  // 選分頁：優先「目前視窗正在看的 portalx 分頁」，避免跨視窗選到別的 portalx 分頁；
  // 都排除停在登入頁的分頁；取不到再退回全域搜尋。
  const notLogin = (t) => !/Login\.aspx/i.test(t.url || '');
  let tab = null;
  try {
    const cur = await chrome.tabs.query({ url: 'https://portalx.yzu.edu.tw/*', active: true, lastFocusedWindow: true });
    tab = cur.find(notLogin) || null;
  } catch { /* lastFocusedWindow 在某些情境不可用，走下面的退路 */ }
  if (!tab) {
    const tabs = (await chrome.tabs.query({ url: 'https://portalx.yzu.edu.tw/*' })).filter(notLogin);
    tab = tabs.find((t) => t.active) || tabs[0] || null;
  }
  if (!tab) return { ok: false, error: '找不到已登入的 portalx 分頁，請先開著成績登錄頁（且不是登入頁）。' };

  const res = await fetch(`${appUrl}/api/portal-sync/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-extension-token': token },
    body: JSON.stringify({ courseId, gradeItemId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };

  // 與 src/lib/portalSync.ts 的 DEFAULT_FILL_CONFIG 同值（保持與舊腳本一致；改一邊要改三邊）
  const cfg = {
    rowSelector: 'table tr',
    scoreInput: "input[type='text'], input[type='number'], input[type='tel'], input:not([type])",
    studentIdRegex: '[A-Za-z]?\\d{6,}',
  };
  // 正規化查表：normalize(DB 學號) -> 原始學號（只供比對，不改 DB 值）
  const normMap = {};
  for (const k of Object.keys(data.scoreMap)) normMap[normId(k)] = k;

  // 等 grid render：輪詢任一 frame 是否已出現「含分數輸入框的列」，最多約 5 次×400ms。
  for (let i = 0; i < 5; i++) {
    const probe = await chrome.scripting
      .executeScript({ target: { tabId: tab.id, allFrames: true }, world: 'MAIN', func: pageProbe, args: [cfg] })
      .catch(() => []);
    if (probe.some((p) => p && p.result)) break;
    await sleep(400);
  }

  // allFrames 注入：portalx 成績表可能在 iframe 內，逐 frame 各跑一次再匯總。
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    world: 'MAIN',
    func: pageFill,
    args: [{ scoreMap: data.scoreMap, normMap, cfg }],
  });

  const filledSet = new Set();
  const pageIdSet = new Set();
  let rowsScanned = 0, rowsWithInput = 0, framesScanned = 0;
  for (const r of results) {
    if (!r || !r.result) continue;
    framesScanned++;
    for (const f of r.result.filled) filledSet.add(f);
    for (const p of r.result.pageIds) pageIdSet.add(p);
    rowsScanned += r.result.rowsScanned || 0;
    rowsWithInput += r.result.rowsWithInput || 0;
  }
  const stats = {
    filled: [...filledSet],
    missing: Object.keys(data.scoreMap).filter((s) => !filledSet.has(s)),
    pageIdsSample: [...pageIdSet].slice(0, 15),
    rowsScanned,
    rowsWithInput,
    framesScanned,
  };

  // 單次防呆 alert（只在頂層 frame 跳一次）
  await chrome.scripting
    .executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: pageAlert, args: [stats] })
    .catch(() => {});

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
