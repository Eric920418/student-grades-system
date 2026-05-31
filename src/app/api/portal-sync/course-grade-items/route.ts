import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

// 插件「填成績」用：列出有 portal 對應的課程與其成績項目，供老師在 popup 選。
function tokenOk(provided: string | null): boolean {
  const expected = process.env.EXTENSION_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  try {
    if (!tokenOk(request.headers.get('x-extension-token'))) {
      return NextResponse.json({ error: '未授權（配對 token 不符）' }, { status: 401 });
    }

    const courses = await prisma.course.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        code: true,
        portalCosId: true,
        gradeItems: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, maxScore: true },
        },
      },
    });

    return NextResponse.json({ courses });
  } catch (error) {
    console.error('取得課程成績項目錯誤:', error);
    return NextResponse.json(
      { error: '取得課程成績項目失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
