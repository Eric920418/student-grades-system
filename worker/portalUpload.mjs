// GitHub Actions worker：登入 portalx → 逐格填分 →（可選送出）→ 截圖 → 回報結果。
// 由 .github/workflows/portal-upload.yml 在 repository_dispatch[portal-upload] 觸發。
//
// 機密來自 GitHub Secrets（env）；任務參數來自 client_payload（env CLIENT_PAYLOAD）。
// 絕不 console.log 分數或帳密。

import { chromium } from 'playwright';
import { put } from '@vercel/blob';
import { login, gotoGradePage, submit } from './portalConfig.mjs';

const {
  PORTAL_USERNAME,
  PORTAL_PASSWORD,
  WORKER_CALLBACK_SECRET,
  APP_CALLBACK_URL,
  BLOB_READ_WRITE_TOKEN,
  CLIENT_PAYLOAD,
} = process.env;

async function reportStatus(jobId, status, extra = {}) {
  if (!APP_CALLBACK_URL || !WORKER_CALLBACK_SECRET) {
    console.log('（未設定 callback，略過回報）', status, extra.message || '');
    return;
  }
  try {
    const res = await fetch(APP_CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': WORKER_CALLBACK_SECRET,
      },
      body: JSON.stringify({ jobId, status, ...extra }),
    });
    if (!res.ok) console.error('回報狀態失敗:', res.status, await res.text());
  } catch (err) {
    console.error('回報狀態例外:', err.message);
  }
}

async function main() {
  if (!CLIENT_PAYLOAD) throw new Error('缺少 CLIENT_PAYLOAD');
  const payload = JSON.parse(CLIENT_PAYLOAD);
  const { jobId, scoreMap, dryRun, fillConfig } = payload;
  // client_payload 由觸發者提供，jobId 僅允許安全字元（用於 Blob key），防止異常 key
  const safeJobId = String(jobId || '').replace(/[^a-zA-Z0-9_-]/g, '');

  if (!PORTAL_USERNAME || !PORTAL_PASSWORD) {
    await reportStatus(jobId, 'failed', {
      message: '缺少 PORTAL_USERNAME / PORTAL_PASSWORD（請設定 GitHub Secret）',
    });
    process.exit(1);
  }

  await reportStatus(jobId, 'running', { message: '已啟動 worker，登入 portalx…' });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await login(page, { username: PORTAL_USERNAME, password: PORTAL_PASSWORD });
    await gotoGradePage(page, payload);

    // 在頁面內執行填值演算法（與 src/lib/portalSync.ts 的 FILL_FUNCTION_SOURCE 同一套邏輯，
    // 以真實函式傳給 page.evaluate，不用 new Function、不受 CSP 影響）。
    const stats = await page.evaluate(
      ({ scoreMap, cfg }) => {
        const re = new RegExp(cfg.studentIdRegex);
        const rows = [...document.querySelectorAll(cfg.rowSelector)];
        const filled = [];
        const skippedNotInMap = [];
        const usedIds = new Set();
        for (const row of rows) {
          const input = row.querySelector(cfg.scoreInput);
          if (!input) continue;
          const haystack = [input.name, input.id, row.innerText].filter(Boolean).join(' ');
          const match = haystack.match(re);
          if (!match) continue;
          const sid = match[0];
          if (Object.prototype.hasOwnProperty.call(scoreMap, sid)) {
            input.value = String(scoreMap[sid]);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            filled.push(sid);
            usedIds.add(sid);
          } else {
            skippedNotInMap.push(sid);
          }
        }
        const missingInDom = Object.keys(scoreMap).filter((id) => !usedIds.has(id));
        return { filled, skippedNotInMap, missingInDom };
      },
      { scoreMap, cfg: fillConfig }
    );

    const filledCount = stats.filled.length;
    let message =
      `已填入 ${filledCount} 筆` +
      (stats.missingInDom.length
        ? `；${stats.missingInDom.length} 個學號在頁面找不到欄位：${stats.missingInDom.join(', ')}`
        : '');

    if (!dryRun) {
      await submit(page);
      message = `（正式送出）${message}`;
    } else {
      message = `（乾跑，未送出）${message}`;
    }

    // 截圖 → 上傳 Blob
    const shot = await page.screenshot({ fullPage: true });
    let screenshotUrl;
    if (BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`portal-uploads/${safeJobId}.png`, shot, {
        access: 'public',
        token: BLOB_READ_WRITE_TOKEN,
        contentType: 'image/png',
        addRandomSuffix: true,
      });
      screenshotUrl = blob.url;
    }

    await reportStatus(jobId, 'success', { filledCount, message, screenshotUrl });
  } catch (err) {
    // 失敗也盡量截圖協助除錯
    let screenshotUrl;
    try {
      const shot = await page.screenshot({ fullPage: true });
      if (BLOB_READ_WRITE_TOKEN) {
        const blob = await put(`portal-uploads/${safeJobId}-error.png`, shot, {
          access: 'public',
          token: BLOB_READ_WRITE_TOKEN,
          contentType: 'image/png',
          addRandomSuffix: true,
        });
        screenshotUrl = blob.url;
      }
    } catch {
      /* 截圖失敗就算了 */
    }
    await reportStatus(payload?.jobId, 'failed', {
      message: `執行失敗：${err.message}`,
      screenshotUrl,
    });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
