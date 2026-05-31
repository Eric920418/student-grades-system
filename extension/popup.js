const btn = document.getElementById('sync');
const msg = document.getElementById('msg');

document.getElementById('opt').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

function render(state) {
  if (!state) { msg.textContent = ''; msg.className = ''; btn.disabled = false; return; }
  if (state.status === 'running') {
    btn.disabled = true;
    msg.className = '';
    msg.textContent = '⏳ ' + (state.progress || '執行中…') + '（可關閉此視窗，進度會繼續）';
  } else if (state.status === 'done') {
    btn.disabled = false;
    msg.className = 'ok';
    msg.textContent = `✅ 已撈取 ${state.count} 門課程，請到成績系統勾選要建立的課：`;
    const a = document.createElement('a');
    a.href = `${state.appUrl}/portal-courses?job=${state.jobId}`;
    a.target = '_blank';
    a.textContent = '成績系統 → 匯入課程';
    msg.appendChild(document.createElement('br'));
    msg.appendChild(a);
  } else if (state.status === 'error') {
    btn.disabled = false;
    msg.className = 'err';
    msg.textContent = '❌ ' + state.error;
  }
}

async function refresh() {
  const o = await chrome.storage.local.get('portalSync');
  render(o.portalSync);
}

// 開啟時先顯示目前狀態，並持續輪詢（爬取在 background 跑）
refresh();
setInterval(refresh, 1500);

btn.addEventListener('click', () => {
  btn.disabled = true;
  msg.className = '';
  msg.textContent = '⏳ 開始撈取…';
  // 觸發即可，存取 lastError 以消除「port closed」警告；進度改看 storage
  chrome.runtime.sendMessage({ type: 'START' }, () => { void chrome.runtime.lastError; });
});
