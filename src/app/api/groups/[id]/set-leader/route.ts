import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// 老師指定某位成員為組長（會自動取消該組其他組長）
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const body = await request.json();
    const { studentGroupId } = body as { studentGroupId?: string };
    if (!studentGroupId) {
      return NextResponse.json({ error: '缺少 studentGroupId' }, { status: 400 });
    }

    const target = await prisma.studentGroup.findUnique({
      where: { id: studentGroupId },
      select: { id: true, groupId: true },
    });
    if (!target) {
      return NextResponse.json({ error: '找不到該成員記錄' }, { status: 404 });
    }
    if (target.groupId !== params.id) {
      return NextResponse.json(
        { error: '該成員不屬於此組（groupId 不匹配）' },
        { status: 400 }
      );
    }

    // 原子操作：先把組內其他成員降級，再把目標升為組長
    await prisma.$transaction([
      prisma.studentGroup.updateMany({
        where: { groupId: params.id, NOT: { id: studentGroupId } },
        data: { isLeader: false },
      }),
      prisma.studentGroup.update({
        where: { id: studentGroupId },
        data: { isLeader: true },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('老師設定組長 API 錯誤:', error);
    return NextResponse.json(
      {
        error: '設定組長失敗',
        details: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 }
    );
  }
}
