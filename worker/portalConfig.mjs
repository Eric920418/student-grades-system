// portalx 專屬的登入流程、導航與 selector。
//
// ⚠️⚠️ 這是整個 worker 唯一「需要 portalx 實際頁面才能填準」的部分。
// 目前 selector 為「合理猜測」，多半需依真實 HTML 調整。所有值都可用環境變數覆蓋，
// 方便先對「假 portal 頁」測試管線（設 PORTAL_LOGIN_URL 指向 mock 即可）。
//
// 待使用者提供：①登入頁帳密欄/登入鈕 ②從首頁點到成績登錄頁的路徑 ③成績頁列/輸入框/學號 selector。

export const portalConfig = {
  loginUrl:
    process.env.PORTAL_LOGIN_URL ||
    'https://portalx.yzu.edu.tw/PortalSocialVB/Login.aspx',

  // TODO(實際 selector 待確認) — ASP.NET WebForms 常見命名的猜測
  usernameSelector:
    process.env.PORTAL_USER_SEL ||
    'input[name*="Account"], input[name*="UserName"], input[type="text"]',
  passwordSelector: process.env.PORTAL_PASS_SEL || 'input[type="password"]',
  loginButtonSelector:
    process.env.PORTAL_LOGIN_BTN ||
    'input[type="submit"], button[type="submit"]',
  // 登入成功的判斷依據（出現此 selector 視為已登入）。待確認。
  loginSuccessSelector: process.env.PORTAL_LOGIN_OK_SEL || '',

  // 成績登錄頁：先支援「直達 URL」(若 portalx 該頁有固定網址)。
  // 若必須點選單導航，於 gotoGradePage() 補點擊步驟。
  gradePageUrl: process.env.PORTAL_GRADE_URL || '',

  // 送出/儲存成績的按鈕。待確認。
  submitButtonSelector:
    process.env.PORTAL_SUBMIT_BTN ||
    'input[type="submit"][value*="存"], input[type="submit"][value*="送"], #Btn_Save',
};

/** 登入 portalx。portalx 已確認無驗證碼/2FA，故帳密直接送出即可。 */
export async function login(page, { username, password }) {
  await page.goto(portalConfig.loginUrl, { waitUntil: 'domcontentloaded' });
  await page.fill(portalConfig.usernameSelector, username);
  await page.fill(portalConfig.passwordSelector, password);
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.click(portalConfig.loginButtonSelector),
  ]);
  if (portalConfig.loginSuccessSelector) {
    await page.waitForSelector(portalConfig.loginSuccessSelector, { timeout: 15000 });
  }
}

/**
 * 導航到指定成績項目的成績登錄頁。
 * payload 含 { gradeItemName, ... }，可用來在選單中選對應項目。
 * TODO：實際多半要點選單/選課程/選成績項目，待 portalx 頁面確認後補上點擊步驟。
 */
export async function gotoGradePage(page, payload) {
  if (!portalConfig.gradePageUrl) {
    throw new Error(
      '尚未設定成績登錄頁路徑：請提供 portalx 成績頁 URL（設 PORTAL_GRADE_URL）或在 gotoGradePage() 補上導航點擊步驟'
    );
  }
  await page.goto(portalConfig.gradePageUrl, { waitUntil: 'domcontentloaded' });
  // 例：若該頁要選成績項目下拉，可在此 page.selectOption(...) 依 payload.gradeItemName 選擇
}

/** 正式送出（儲存）成績。dryRun 時不會呼叫此函式。 */
export async function submit(page) {
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.click(portalConfig.submitButtonSelector),
  ]);
}
