import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// 老師專用：刪除指定組別的期中報告 PDF
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const group = await prisma.group.findUnique({
      where: { id: params.id },
      select: { id: true, reportUrl: true },
    });
    if (!group) {
      return NextResponse.json({ error: '找不到指定的組別' }, { status: 404 });
    }

    if (group.reportUrl) {
      try {
        await del(group.reportUrl);
      } catch (e) {
        console.error('刪除 blob 失敗（仍繼續清空 DB）:', e);
      }
    }

    await prisma.group.update({
      where: { id: params.id },
      data: {
        reportUrl: null,
        reportFileName: null,
        reportUploadedAt: null,
        reportUploadedById: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('老師刪除報告 API 錯誤:', error);
    return NextResponse.json(
      {
        error: '刪除失敗',
        details: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 }
    );
  }
}
