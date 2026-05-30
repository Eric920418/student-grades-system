const btn = document.getElementById('sync');
const msg = document.getElementById('msg');

document.getElementById('opt').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

btn.addEventListener('click', () => {
  btn.disabled = true;
  msg.className = '';
  msg.textContent = '撈取中…正逐門課讀取，約 1–3 分鐘，請勿關閉視窗。';
  chrome.runtime.sendMessage({ type: 'CRAWL' }, (res) => {
    btn.disabled = false;
    if (res && res.ok) {
      msg.className = 'ok';
      msg.textContent = `✅ 已撈取 ${res.count} 門課程，請到成績系統勾選要建立的課：`;
      const a = document.createElement('a');
      a.href = `${res.appUrl}/portal-courses?job=${res.jobId}`;
      a.target = '_blank';
      a.textContent = '成績系統 → 匯入課程';
      msg.appendChild(document.createElement('br'));
      msg.appendChild(a);
    } else {
      msg.className = 'err';
      msg.textContent = '❌ ' + (res ? res.error : '未知錯誤');
    }
  });
});
