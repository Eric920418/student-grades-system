import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// 老師批次為「有成員但無組長」的組指定組長（選擇最早加入的那位）
export async function POST(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const body = await request.json().catch(() => ({}));
    const { courseId } = body as { courseId?: string };

    const groups = await prisma.group.findMany({
      where: courseId ? { courseId } : {},
      include: {
        studentGroups: {
          orderBy: { createdAt: 'asc' },
          include: { student: { select: { name: true, studentId: true } } },
        },
      },
    });

    // 挑出「有成員但無組長」的組，選最早加入者
    type Target = {
      groupId: string;
      groupName: string;
      targetId: string;
      targetName: string;
      targetStudentId: string;
    };
    const targets: Target[] = [];
    let skippedHasLeader = 0;
    let skippedEmpty = 0;

    for (const g of groups) {
      if (g.studentGroups.length === 0) {
        skippedEmpty++;
        continue;
      }
      const hasLeader = g.studentGroups.some((sg) => sg.isLeader);
      if (hasLeader) {
        skippedHasLeader++;
        continue;
      }
      const first = g.studentGroups[0];
      targets.push({
        groupId: g.id,
        groupName: g.name,
        targetId: first.id,
        targetName: first.student.name,
        targetStudentId: first.student.studentId,
      });
    }

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        assigned: 0,
        skippedHasLeader,
        skippedEmpty,
        details: [],
        message: '沒有需要指定組長的組',
      });
    }

    await prisma.$transaction(
      targets.map((t) =>
        prisma.studentGroup.update({
          where: { id: t.targetId },
          data: { isLeader: true },
        })
      )
    );

    return NextResponse.json({
      success: true,
      assigned: targets.length,
      skippedHasLeader,
      skippedEmpty,
      details: targets.map((t) => ({
        group: t.groupName,
        leader: `${t.targetName}（${t.targetStudentId}）`,
      })),
    });
  } catch (error) {
    console.error('批次指定組長 API 錯誤:', error);
    return NextResponse.json(
      {
        error: '批次指定失敗',
        details: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 }
    );
  }
}
