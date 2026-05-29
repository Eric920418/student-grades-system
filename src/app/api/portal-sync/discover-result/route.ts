import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

// GitHub Actions worker 回寫「發現的課程清單」。worker 驗證用 x-worker-secret。
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
    const { jobId, courses } = body as { jobId?: string; courses?: unknown[] };
    if (!jobId || !Array.isArray(courses)) {
      return NextResponse.json({ error: '缺少 jobId 或 courses' }, { status: 400 });
    }

    await prisma.portalUploadJob.update({
      where: { id: jobId },
      data: {
        status: 'success',
        totalCount: courses.length,
        message: `發現 ${courses.length} 門課程`,
        resultJson: JSON.stringify(courses),
      },
    });

    return NextResponse.json({ ok: true, count: courses.length });
  } catch (error) {
    console.error('discover 回寫錯誤:', error);
    return NextResponse.json(
      { error: 'discover 回寫失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
