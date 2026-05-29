// 校務系統(portalx) 同步 — 共用模組
//
// 設計：腳本在「老師已登入的 portalx 分頁」裡執行，操作 DOM。本系統不直接連 portalx
// （同源政策擋住跨網域請求），故：
//   - 上傳成績：本系統產生內嵌分數的腳本 → 老師貼到 portalx console 執行。
//   - 撈名單：portalx 端腳本抓 DOM → 組 JSON → 複製到剪貼簿 → 老師貼回本系統匯入頁。
//
// portalx 是 ASP.NET WebForms，實際 DOM 結構待確認，故所有 selector / 正則都抽成可調設定，
// 演算法本身固定不變。

/** YZU 學號的擷取正則（預設 7+ 位數字，可含前置英文字母）。以字串形式保存以便存入設定與序列化。 */
export const STUDENT_ID_REGEX_SOURCE = '[A-Za-z]?\\d{6,}';

/** 匯入 JSON 的格式版本與種類，貼回時用來驗證內容正確。 */
export const IMPORT_JSON_VERSION = 1;
export type ImportKind = 'students';

export interface ImportRow {
  studentId: string;
  name?: string;
  class?: string;
  email?: string;
}

export interface ImportPayload {
  _v: number;
  kind: ImportKind;
  rows: ImportRow[];
}

/** 上傳成績（填分）用的 selector 設定。 */
export interface FillSelectorConfig {
  /** 每位學生一列 */
  rowSelector: string;
  /** 該列要填分數的輸入框 */
  scoreInput: string;
  /** 從輸入框 name/id 或整列文字擷取學號的正則來源字串 */
  studentIdRegex: string;
}

export const DEFAULT_FILL_CONFIG: FillSelectorConfig = {
  rowSelector: 'table tr',
  scoreInput: "input[type='text'], input:not([type])",
  studentIdRegex: STUDENT_ID_REGEX_SOURCE,
};

/** 撈名單用：每個欄位對應的 selector（相對於列）。 */
export interface ScrapeColumnMap {
  studentId: string;
  name?: string;
  class?: string;
  email?: string;
}

export interface ScrapeSelectorConfig {
  rowSelector: string;
  columnMap: ScrapeColumnMap;
}

// 對應 portalx 名單頁 ClassMate.aspx 的真實結構（#Std_info 表）。
// 班別(A/B)不是列欄位、而是頁面層級(cosclass)，故 columnMap 不含 class。
export const DEFAULT_SCRAPE_CONFIG: ScrapeSelectorConfig = {
  rowSelector: '#Std_info table tr',
  columnMap: {
    studentId: 'td:nth-child(2)',
    name: 'td:nth-child(3)',
    email: 'td:nth-child(6)',
  },
};

/**
 * 核心填值演算法（純函式，在瀏覽器或 Playwright page.evaluate 環境執行）。
 * 逐列讀出學號（從 input 的 name/id 或整列文字），用學號比對 SCORE_MAP 填值；
 * 找不到對應學號的列一律跳過（不會誤填非本班學生）。回傳防呆統計。
 *
 * 以「字串」形式輸出，方便：①嵌進 Console 腳本 ②worker 用 page.evaluate 注入。
 * ⚠️ 若修改此演算法，worker/fillAlgorithm.mjs 需同步保持一致。
 */
export const FILL_FUNCTION_SOURCE = `function __portalFill(SCORE_MAP, rawConfig) {
  const CONFIG = {
    rowSelector: rawConfig.rowSelector,
    scoreInput: rawConfig.scoreInput,
    studentIdRegex: new RegExp(rawConfig.studentIdRegex),
  };
  const rows = [...document.querySelectorAll(CONFIG.rowSelector)];
  const filled = [];
  const skippedNotInMap = [];
  const usedIds = new Set();
  for (const row of rows) {
    const input = row.querySelector(CONFIG.scoreInput);
    if (!input) continue;
    const haystack = [input.name, input.id, row.innerText].filter(Boolean).join(" ");
    const match = haystack.match(CONFIG.studentIdRegex);
    if (!match) continue;
    const sid = match[0];
    if (Object.prototype.hasOwnProperty.call(SCORE_MAP, sid)) {
      input.value = String(SCORE_MAP[sid]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      filled.push(sid);
      usedIds.add(sid);
    } else {
      skippedNotInMap.push(sid);
    }
  }
  const missingInDom = Object.keys(SCORE_MAP).filter((id) => !usedIds.has(id));
  return { filled: filled, skippedNotInMap: skippedNotInMap, missingInDom: missingInDom };
}`;

/**
 * 產生貼到 portalx Console 的「填分腳本」：嵌入填值演算法 + 學號 map + 設定，
 * 執行後 console + alert 顯示防呆統計。
 */
export function buildFillScript(
  scoreMap: Record<string, number>,
  config: FillSelectorConfig = DEFAULT_FILL_CONFIG
): string {
  return `/* ===== 可調整設定（拿到 portalx 實際 HTML 後微調）===== */
const CONFIG = {
  rowSelector: ${JSON.stringify(config.rowSelector)},
  scoreInput: ${JSON.stringify(config.scoreInput)},
  studentIdRegex: ${JSON.stringify(config.studentIdRegex)},
};

/* ===== 由成績系統產生的資料：{ 學號: 分數 } ===== */
const SCORE_MAP = ${JSON.stringify(scoreMap, null, 2)};

/* ===== 核心演算法 ===== */
${FILL_FUNCTION_SOURCE}

/* ===== 執行 + 防呆統計 ===== */
(function () {
  const r = __portalFill(SCORE_MAP, CONFIG);
  console.log("%c=== 填分結果 ===", "font-weight:bold;font-size:14px");
  console.log("已填入：" + r.filled.length + " 筆", r.filled);
  console.log("DOM 有此列但 map 無對應(略過)：" + r.skippedNotInMap.length + " 筆", r.skippedNotInMap);
  console.log("map 有但 DOM 找不到(未填)：" + r.missingInDom.length + " 筆", r.missingInDom);
  let msg = "✅ 已填入 " + r.filled.length + " 筆成績。";
  if (r.missingInDom.length) {
    msg += "\\n\\n⚠️ 有 " + r.missingInDom.length + " 個學號在頁面上找不到對應欄位，未填入：\\n" + r.missingInDom.join(", ") + "\\n\\n（請確認是否分頁、排序不同，或學號格式需調整 CONFIG.studentIdRegex）";
  }
  alert(msg);
})();`;
}

/**
 * 產生「抓取名單腳本」。逐列依 columnMap 讀欄位文字，用學號正則當守門過濾表頭/空列，
 * 組成 { _v, kind, rows } 後複製到剪貼簿，供老師貼回本系統匯入頁。
 */
export function buildScrapeScript(
  config: ScrapeSelectorConfig = DEFAULT_SCRAPE_CONFIG
): string {
  return `/* ===== 可調整設定（拿到 portalx 實際 HTML 後微調）===== */
const CONFIG = {
  rowSelector: ${JSON.stringify(config.rowSelector)},
  columnMap: ${JSON.stringify(config.columnMap, null, 2)},
  studentIdRegex: new RegExp(${JSON.stringify(STUDENT_ID_REGEX_SOURCE)}),
};

/* ===== 主邏輯：抓 DOM → 組 JSON → 複製剪貼簿 ===== */
(function () {
  const text = (el) => (el && el.innerText ? el.innerText.trim() : "");
  const rows = [...document.querySelectorAll(CONFIG.rowSelector)];
  const out = [];

  for (const row of rows) {
    const sidCell = row.querySelector(CONFIG.columnMap.studentId);
    const sid = text(sidCell);
    if (!CONFIG.studentIdRegex.test(sid)) continue; // 過濾表頭/空列/非學號列
    const rec = { studentId: sid };
    for (const key of ["name", "class", "email"]) {
      const sel = CONFIG.columnMap[key];
      if (sel) {
        const v = text(row.querySelector(sel));
        if (v) rec[key] = v;
      }
    }
    out.push(rec);
  }

  const payload = { _v: ${IMPORT_JSON_VERSION}, kind: "students", rows: out };
  const json = JSON.stringify(payload, null, 2);

  navigator.clipboard.writeText(json).then(
    () => alert("✅ 已抓取 " + out.length + " 筆並複製到剪貼簿。\\n請回到成績系統的「校務同步」頁貼上。"),
    () => {
      console.log(json);
      alert("⚠️ 已抓取 " + out.length + " 筆，但複製到剪貼簿失敗（瀏覽器限制）。\\n請從 Console 手動複製上方印出的 JSON。");
    }
  );
})();`;
}
