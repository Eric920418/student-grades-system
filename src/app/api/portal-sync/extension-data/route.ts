import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

// Chrome 插件在瀏覽器爬完 portalx，把「課程+名單結果」上傳這裡（不送 cookie）。
// 以 x-extension-token == EXTENSION_TOKEN 驗證。
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
    const { courses } = body as { courses?: unknown[] };
    if (!Array.isArray(courses) || courses.length === 0) {
      return NextResponse.json({ error: '沒有收到課程資料' }, { status: 400 });
    }

    // 存成一筆 discover 任務，resultJson 內含課程與各課名單
    const job = await prisma.portalUploadJob.create({
      data: {
        kind: 'discover',
        status: 'success',
        totalCount: courses.length,
        message: `插件已爬取 ${courses.length} 門課程`,
        resultJson: JSON.stringify(courses),
      },
    });

    return NextResponse.json({ ok: true, jobId: job.id, count: courses.length });
  } catch (error) {
    console.error('接收插件資料錯誤:', error);
    return NextResponse.json(
      { error: '接收插件資料失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
