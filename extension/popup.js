const btn = document.getElementById('sync');
const msg = document.getElementById('msg');
const courseSel = document.getElementById('course');
const itemSel = document.getElementById('item');
const fillBtn = document.getElementById('fill');
const fillMsg = document.getElementById('fillmsg');

document.getElementById('opt').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ── ① 同步課程＋名單（背景跑、輪詢 storage）──
function renderSync(state) {
  if (!state) { msg.textContent = ''; msg.className = 'msg'; btn.disabled = false; return; }
  if (state.status === 'running') {
    btn.disabled = true; msg.className = 'msg';
    msg.textContent = '⏳ ' + (state.progress || '執行中…') + '（可關閉此視窗，進度會繼續）';
  } else if (state.status === 'done') {
    btn.disabled = false; msg.className = 'msg ok';
    msg.textContent = `✅ 已撈取 ${state.count} 門課程：`;
    const a = document.createElement('a');
    a.href = `${state.appUrl}/portal-courses?job=${state.jobId}`;
    a.target = '_blank'; a.textContent = '成績系統 → 匯入課程';
    msg.appendChild(document.createElement('br')); msg.appendChild(a);
  } else if (state.status === 'error') {
    btn.disabled = false; msg.className = 'msg err'; msg.textContent = '❌ ' + state.error;
  }
}
async function refreshSync() {
  const o = await chrome.storage.local.get('portalSync');
  renderSync(o.portalSync);
}
refreshSync();
setInterval(refreshSync, 1500);
btn.addEventListener('click', () => {
  btn.disabled = true; msg.className = 'msg'; msg.textContent = '⏳ 開始撈取…';
  chrome.runtime.sendMessage({ type: 'START' }, () => { void chrome.runtime.lastError; });
});

// ── ② 填成績 ──
let coursesData = [];

function loadCourses() {
  chrome.runtime.sendMessage({ type: 'GET_COURSES' }, (res) => {
    void chrome.runtime.lastError;
    if (!res || !res.ok) {
      courseSel.innerHTML = '<option value="">（載入失敗）</option>';
      fillMsg.className = 'msg err';
      fillMsg.textContent = res ? '❌ ' + res.error : '❌ 載入課程失敗';
      return;
    }
    coursesData = res.courses;
    if (!coursesData.length) {
      courseSel.innerHTML = '<option value="">（尚無課程，請先同步）</option>';
      return;
    }
    courseSel.innerHTML = '<option value="">選擇課程</option>' +
      coursesData.map((c) => `<option value="${c.id}">${c.name}${c.code ? ' (' + c.code + ')' : ''}</option>`).join('');
  });
}

courseSel.addEventListener('change', () => {
  const c = coursesData.find((x) => x.id === courseSel.value);
  if (!c) { itemSel.innerHTML = '<option value="">先選課程</option>'; fillBtn.disabled = true; return; }
  if (!c.gradeItems.length) {
    itemSel.innerHTML = '<option value="">（此課程無成績項目）</option>'; fillBtn.disabled = true; return;
  }
  itemSel.innerHTML = '<option value="">選擇成績項目</option>' +
    c.gradeItems.map((g) => `<option value="${g.id}">${g.name}（滿分 ${g.maxScore}）</option>`).join('');
  fillBtn.disabled = true;
});

itemSel.addEventListener('change', () => {
  fillBtn.disabled = !(courseSel.value && itemSel.value);
});

fillBtn.addEventListener('click', () => {
  fillBtn.disabled = true;
  fillMsg.className = 'msg';
  fillMsg.textContent = '⏳ 填入中…';
  chrome.runtime.sendMessage({ type: 'FILL', courseId: courseSel.value, gradeItemId: itemSel.value }, (res) => {
    void chrome.runtime.lastError;
    fillBtn.disabled = false;
    if (!res || !res.ok) {
      fillMsg.className = 'msg err';
      fillMsg.textContent = '❌ ' + (res ? res.error : '填入失敗');
      return;
    }
    const s = res.stats || { filled: [], missing: [] };
    fillMsg.className = 'msg ok';
    let t = `✅ 已填入 ${s.filled.length} 筆（共 ${res.count} 筆成績）。`;
    if (s.missing && s.missing.length) {
      t += `\n⚠️ ${s.missing.length} 個學號在頁面找不到欄位：${s.missing.slice(0, 10).join(', ')}${s.missing.length > 10 ? '…' : ''}`;
    }
    t += '\n請在 portalx 頁面核對後自行按「送出/儲存」。';
    fillMsg.textContent = t;
  });
});

loadCourses();
