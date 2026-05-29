import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// 只更新課程的 portal 對應欄位（課號/學年/學期），不動其他課程資料。
export async function POST(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const body = await request.json();
    const { courseId, portalCosId, portalYear, portalSemester } = body as {
      courseId?: string;
      portalCosId?: string;
      portalYear?: string;
      portalSemester?: string;
    };

    if (!courseId) {
      return NextResponse.json({ error: '缺少 courseId' }, { status: 400 });
    }

    const course = await prisma.course.update({
      where: { id: courseId },
      data: {
        portalCosId: portalCosId?.trim() || null,
        portalYear: portalYear?.trim() || null,
        portalSemester: portalSemester?.trim() || null,
      },
    });

    return NextResponse.json({
      portalCosId: course.portalCosId,
      portalYear: course.portalYear,
      portalSemester: course.portalSemester,
    });
  } catch (error) {
    console.error('更新 portal 對應錯誤:', error);
    return NextResponse.json(
      { error: '更新 portal 對應失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
