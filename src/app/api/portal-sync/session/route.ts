import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { triggerWorker } from '@/lib/portalDispatch';

// Chrome 插件上傳「老師已登入 portalx 的 session cookie」。
// 以 x-extension-token == EXTENSION_TOKEN 驗證（插件不是登入的 admin）。
function tokenOk(provided: string | null): boolean {
  const expected = process.env.EXTENSION_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    if (!tokenOk(request.headers.get('x-extension-token'))) {
      return NextResponse.json({ error: '未授權（配對 token 不符）' }, { status: 401 });
    }

    const body = await request.json();
    const { cookies, action } = body as { cookies?: unknown[]; action?: string };
    if (!Array.isArray(cookies) || cookies.length === 0) {
      return NextResponse.json({ error: '沒有收到 portalx cookie，請先在 Chrome 登入 portalx' }, { status: 400 });
    }

    // 存最新 session（單筆 upsert）
    await prisma.portalSession.upsert({
      where: { id: 'current' },
      update: { cookiesJson: JSON.stringify(cookies) },
      create: { id: 'current', cookiesJson: JSON.stringify(cookies) },
    });

    // 預設順手觸發「發現課程」
    if (action === 'discover' || !action) {
      const job = await prisma.portalUploadJob.create({
        data: { kind: 'discover', status: 'pending', dryRun: true },
      });
      const gh = await triggerWorker({ mode: 'discover', jobId: job.id });
      if (!gh.ok) {
        await prisma.portalUploadJob.update({
          where: { id: job.id },
          data: { status: 'failed', message: gh.configured ? `GitHub 觸發失敗 (${gh.status}): ${gh.text}` : gh.text },
        });
        return NextResponse.json(
          { error: '已收到 session，但觸發 worker 失敗', details: gh.text },
          { status: 502 }
        );
      }
      return NextResponse.json({ ok: true, cookieCount: cookies.length, jobId: job.id });
    }

    return NextResponse.json({ ok: true, cookieCount: cookies.length });
  } catch (error) {
    console.error('接收 session 錯誤:', error);
    return NextResponse.json(
      { error: '接收 session 失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
