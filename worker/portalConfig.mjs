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

  // 已從公開登入頁(Login.aspx)確認的真實 selector（ASP.NET WebForms，無驗證碼）
  usernameSelector: process.env.PORTAL_USER_SEL || '#Txt_UserID',
  passwordSelector: process.env.PORTAL_PASS_SEL || '#Txt_Password',
  loginButtonSelector: process.env.PORTAL_LOGIN_BTN || '#ibnSubmit',
  // 登入成功的判斷依據（出現此 selector 視為已登入）。待確認登入後首頁的元素。
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

// ===== 名單撈取 =====

const ROSTER_BASE =
  process.env.PORTAL_ROSTER_BASE ||
  'https://portalx.yzu.edu.tw/PortalSocialVB/TCon/ClassMate.aspx';

/** 導到某課程某班的名單頁（直接帶網址參數，不必模擬 select 點擊）。 */
export async function gotoRoster(page, { year, semester, cosId, cosClass }) {
  const url = `${ROSTER_BASE}?Menu=Con&y=${encodeURIComponent(year)}&s=${encodeURIComponent(
    semester
  )}&cosid=${encodeURIComponent(cosId)}&cosclass=${encodeURIComponent(cosClass)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

const HOME_URL = process.env.PORTAL_HOME_URL || 'https://portalx.yzu.edu.tw/PortalSocialVB/';

/**
 * 發現帳號的所有課程。流程：首頁左側選單取 (pageId, 課名) → 逐門 GoToPage 進課 →
 * 進 ClassMate(學生) 讀 #Cos_info(cosid/班別/學期) + 判斷 #divMenuMan(管理) 是否顯示=授課老師。
 * 導航行為待真實 portal 驗證，故每門包 try/catch、把 error 一併回傳，方便看 log 迭代。
 */
export async function discoverCourses(page) {
  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});

  const menu = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#MainLeftMenu_divMyPage td[onclick*="GoToPage"]')];
    return items
      .map((td) => {
        const m = (td.getAttribute('onclick') || '').match(/GoToPage\('([^']+)'/);
        return { pageId: m ? m[1] : null, name: (td.textContent || '').trim() };
      })
      .filter((x) => x.pageId);
  });

  const results = [];
  for (const { pageId, name } of menu) {
    try {
      await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      // 進入該課程（GoToPage 設定課程 session context）
      await Promise.all([
        page.waitForLoadState('networkidle').catch(() => {}),
        page.evaluate((pid) => {
          if (typeof GoToPage === 'function') GoToPage(pid, 'tdPage0');
        }, pageId),
      ]);
      // 進「學生」名單頁（不帶 cosid，靠 session 課程 context）
      await page.goto(`${ROSTER_BASE}?Menu=Con`, { waitUntil: 'domcontentloaded' }).catch(() => {});

      const info = await page.evaluate(() => {
        let cosId = '', cosClass = '', semester = '';
        const cos = document.querySelector('#Cos_info table');
        if (cos) {
          for (const r of cos.querySelectorAll('tr')) {
            const c = r.querySelectorAll('td');
            // 資料列：學期(c[1]) 為純數字 1142
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
        const studentCount = document.querySelectorAll('#Std_info table tr').length;
        return { cosId, cosClass, semester, isInstructor, studentCount };
      });

      let year = '', sem = '';
      if (/^\d{4}$/.test(info.semester)) {
        year = info.semester.slice(0, 3);
        sem = info.semester.slice(3);
      }
      results.push({
        pageId,
        name,
        cosId: info.cosId,
        cosClass: info.cosClass,
        year,
        semester: sem,
        isInstructor: info.isInstructor,
        studentCount: info.studentCount,
      });
    } catch (e) {
      results.push({ pageId, name, error: String((e && e.message) || e) });
    }
  }
  return results;
}

/**
 * 解析名單頁 #Std_info 表，回傳 [{ studentId, name, email, withdrawn }]。
 * 對應已確認結構：欄位 [1]學號 [2]姓名(中文(英文)) [5]E-Mail(mailto)；停修者姓名含「(停修)」。
 */
export async function scrapeRoster(page) {
  return page.evaluate(() => {
    const out = [];
    const rows = [...document.querySelectorAll('#Std_info table tr')];
    for (const tr of rows) {
      if (tr.classList.contains('title_line')) continue;
      const cells = tr.querySelectorAll('td');
      if (cells.length < 6) continue;
      const studentId = (cells[1].textContent || '').trim();
      if (!/^\d{6,}$/.test(studentId)) continue; // 跳過表頭/非資料列
      const nameRaw = (cells[2].textContent || '').trim();
      const withdrawn = /停修/.test(nameRaw);
      const name = nameRaw.split('(')[0].replace(/\s+/g, ' ').trim();
      let email = '';
      const a = cells[5].querySelector('a');
      if (a) {
        const addrs = (a.getAttribute('href') || '').replace(/^mailto:/i, '').split(';');
        email = addrs.find((x) => /@mail\.yzu\.edu\.tw/i.test(x)) || addrs[0] || '';
      }
      out.push({ studentId, name, email: email.trim(), withdrawn });
    }
    return out;
  });
}
