// 抓取 portalx 的 cookie（含 HttpOnly，service worker 用 chrome.cookies 才讀得到），
// POST 到成績系統的 /api/portal-sync/session。

const PORTAL_DOMAIN = 'portalx.yzu.edu.tw';

async function getConfig() {
  const { appUrl, token } = await chrome.storage.sync.get(['appUrl', 'token']);
  return {
    appUrl: (appUrl || 'https://student-grades-system.vercel.app').replace(/\/$/, ''),
    token: token || '',
  };
}

async function syncSession() {
  const { appUrl, token } = await getConfig();
  if (!token) {
    return { ok: false, error: '尚未設定配對 token，請先到擴充功能選項填寫。' };
  }

  // 抓所有 portalx 網域的 cookie（含子網域）
  const cookies = await chrome.cookies.getAll({ domain: PORTAL_DOMAIN });
  if (!cookies.length) {
    return { ok: false, error: '抓不到 portalx cookie，請先在 Chrome 登入 portalx 再試。' };
  }

  const payload = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
    expirationDate: c.expirationDate,
  }));

  try {
    const res = await fetch(`${appUrl}/api/portal-sync/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-extension-token': token },
      body: JSON.stringify({ cookies: payload, action: 'discover' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error ? `${data.error}${data.details ? '：' + data.details : ''}` : `HTTP ${res.status}` };
    }
    return { ok: true, cookieCount: data.cookieCount, jobId: data.jobId, appUrl };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'SYNC') {
    syncSession().then(sendResponse);
    return true; // async
  }
});
