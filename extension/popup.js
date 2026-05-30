const btn = document.getElementById('sync');
const msg = document.getElementById('msg');

document.getElementById('opt').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

btn.addEventListener('click', () => {
  btn.disabled = true;
  msg.textContent = '同步中…';
  msg.className = '';
  chrome.runtime.sendMessage({ type: 'SYNC' }, (res) => {
    btn.disabled = false;
    if (res && res.ok) {
      msg.className = 'ok';
      // 用 DOM 建立，避免 innerHTML 注入風險
      msg.textContent = `✅ 已上傳 ${res.cookieCount} 個 cookie，已觸發發現課程。約 1–3 分鐘後到 `;
      const a = document.createElement('a');
      a.href = `${res.appUrl}/portal-courses`;
      a.target = '_blank';
      a.textContent = '成績系統 → 匯入課程';
      msg.appendChild(a);
      msg.appendChild(document.createTextNode(' 查看結果。'));
    } else {
      msg.className = 'err';
      msg.textContent = '❌ ' + (res ? res.error : '未知錯誤');
    }
  });
});
