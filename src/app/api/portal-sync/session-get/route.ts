import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

// worker 拉取最新 portalx session cookie（注入 Playwright 用）。
// 以 x-worker-secret == WORKER_CALLBACK_SECRET 驗證。
function secretOk(provided: string | null): boolean {
  const expected = process.env.WORKER_CALLBACK_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const TTL_MS = 30 * 60 * 1000; // 30 分鐘

export async function POST(request: NextRequest) {
  try {
    if (!secretOk(request.headers.get('x-worker-secret'))) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }
    const session = await prisma.portalSession.findUnique({ where: { id: 'current' } });
    if (!session) {
      return NextResponse.json({ error: '尚無 session，請先用 Chrome 插件上傳' }, { status: 404 });
    }
    if (Date.now() - new Date(session.updatedAt).getTime() > TTL_MS) {
      return NextResponse.json({ error: 'session 已過期，請重新點插件' }, { status: 410 });
    }
    return NextResponse.json({ cookies: JSON.parse(session.cookiesJson) });
  } catch (error) {
    console.error('取得 session 錯誤:', error);
    return NextResponse.json(
      { error: '取得 session 失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
