import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

/**
 * GET /api/group-comments?gradeItemId=xxx
 * 或 ?courseId=xxx(回傳該課程所有成績項目的所有組評語)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gradeItemId = searchParams.get('gradeItemId');
    const courseId = searchParams.get('courseId');

    const where: {
      gradeItemId?: string;
      gradeItem?: { courseId: string };
    } = {};
    if (gradeItemId) where.gradeItemId = gradeItemId;
    if (courseId) where.gradeItem = { courseId };

    const comments = await prisma.groupComment.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('取得評語錯誤:', error);
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    const errorStack = error instanceof Error ? error.stack : '';
    return NextResponse.json(
      {
        error: '取得評語失敗',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/group-comments
 * body: { groupId, gradeItemId, comment }
 * upsert by unique (groupId, gradeItemId)。
 * 若 comment 為空字串(trim 後),則刪除該評語。
 */
export async function POST(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const body = await request.json();
    const { groupId, gradeItemId, comment } = body as {
      groupId?: string;
      gradeItemId?: string;
      comment?: string;
    };

    if (!groupId || !gradeItemId) {
      return NextResponse.json(
        { error: '分組與成績項目為必填' },
        { status: 400 }
      );
    }

    const trimmed = (comment ?? '').trim();

    // 空評語視為刪除
    if (trimmed === '') {
      await prisma.groupComment.deleteMany({
        where: { groupId, gradeItemId },
      });
      return NextResponse.json({ success: true, deleted: true });
    }

    // 確認組別與成績項目存在
    const [group, gradeItem] = await Promise.all([
      prisma.group.findUnique({ where: { id: groupId } }),
      prisma.gradeItem.findUnique({ where: { id: gradeItemId } }),
    ]);

    if (!group) {
      return NextResponse.json({ error: '找不到分組' }, { status: 404 });
    }
    if (!gradeItem) {
      return NextResponse.json({ error: '找不到成績項目' }, { status: 404 });
    }

    const result = await prisma.groupComment.upsert({
      where: {
        groupId_gradeItemId: { groupId, gradeItemId },
      },
      update: { comment: trimmed },
      create: { groupId, gradeItemId, comment: trimmed },
    });

    return NextResponse.json({ success: true, comment: result });
  } catch (error) {
    console.error('儲存評語錯誤:', error);
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    const errorStack = error instanceof Error ? error.stack : '';
    return NextResponse.json(
      {
        error: '儲存評語失敗',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
