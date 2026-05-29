import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

// GitHub Actions worker 回報任務進度/結果用。
// 呼叫者不是登入的老師，改用 x-worker-secret header 與 WORKER_CALLBACK_SECRET 比對驗證。
function secretOk(provided: string | null): boolean {
  const expected = process.env.WORKER_CALLBACK_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    if (!secretOk(request.headers.get('x-worker-secret'))) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, status, filledCount, message, screenshotUrl } = body as {
      jobId?: string;
      status?: string;
      filledCount?: number;
      message?: string;
      screenshotUrl?: string;
    };

    if (!jobId || !status) {
      return NextResponse.json({ error: '缺少 jobId 或 status' }, { status: 400 });
    }
    if (!['running', 'success', 'failed'].includes(status)) {
      return NextResponse.json({ error: `不合法的 status: ${status}` }, { status: 400 });
    }

    const job = await prisma.portalUploadJob.update({
      where: { id: jobId },
      data: {
        status,
        ...(filledCount !== undefined ? { filledCount } : {}),
        ...(message !== undefined ? { message } : {}),
        ...(screenshotUrl !== undefined ? { screenshotUrl } : {}),
      },
    });

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (error) {
    console.error('更新任務狀態錯誤:', error);
    return NextResponse.json(
      { error: '更新任務狀態失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
