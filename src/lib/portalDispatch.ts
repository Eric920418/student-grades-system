// 共用：呼叫 GitHub repository_dispatch 觸發 portal-upload worker。
export async function triggerWorker(
  clientPayload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; text: string; configured: boolean }> {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!repo || !token) {
    return { ok: false, status: 0, text: '未設定 GITHUB_REPO / GITHUB_DISPATCH_TOKEN', configured: false };
  }
  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event_type: 'portal-upload', client_payload: clientPayload }),
  });
  return { ok: res.ok, status: res.status, text: res.ok ? '' : await res.text(), configured: true };
}
