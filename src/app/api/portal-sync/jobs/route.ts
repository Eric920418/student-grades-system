import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// 列出某課程最近的自動上傳任務，供前端輪詢顯示狀態。
export async function GET(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const courseId = searchParams.get('courseId');
    const latestKind = searchParams.get('latestKind');

    // 依 jobId 取單一任務（discover 任務無 courseId，走這條）
    if (jobId) {
      const job = await prisma.portalUploadJob.findUnique({ where: { id: jobId } });
      return NextResponse.json(job ? [job] : []);
    }

    // 取某類型最新一筆（如 /portal-courses 直接開時載入最近的 discover 結果）
    // 已由上方 requireAdmin 限定老師才可存取；kind 以白名單驗證。
    if (latestKind) {
      if (!['grades', 'roster', 'discover'].includes(latestKind)) {
        return NextResponse.json({ error: '不合法的 kind' }, { status: 400 });
      }
      const job = await prisma.portalUploadJob.findFirst({
        where: { kind: latestKind },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(job ? [job] : []);
    }

    if (!courseId) {
      return NextResponse.json({ error: '缺少 courseId 或 jobId' }, { status: 400 });
    }

    const jobs = await prisma.portalUploadJob.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error('取得任務列表錯誤:', error);
    return NextResponse.json(
      { error: '取得任務列表失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
