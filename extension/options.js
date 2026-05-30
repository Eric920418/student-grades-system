const appUrlEl = document.getElementById('appUrl');
const tokenEl = document.getElementById('token');
const statusEl = document.getElementById('status');

chrome.storage.sync.get(['appUrl', 'token']).then(({ appUrl, token }) => {
  if (appUrl) appUrlEl.value = appUrl;
  if (token) tokenEl.value = token;
});

document.getElementById('save').addEventListener('click', async () => {
  await chrome.storage.sync.set({
    appUrl: appUrlEl.value.trim(),
    token: tokenEl.value.trim(),
  });
  statusEl.textContent = '已儲存 ✓';
  setTimeout(() => (statusEl.textContent = ''), 2000);
});
