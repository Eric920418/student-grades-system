import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/grades/group
 * 為整個分組的所有成員批次登記相同成績
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, gradeItemId, score } = body;

    // 驗證必填欄位
    if (!groupId || !gradeItemId || score === undefined || score === null) {
      return NextResponse.json(
        { error: '分組、成績項目和分數為必填欄位' },
        { status: 400 }
      );
    }

    if (score < 0) {
      return NextResponse.json(
        { error: '分數不能為負數' },
        { status: 400 }
      );
    }

    // 檢查分組和成績項目是否存在
    const [group, gradeItem] = await Promise.all([
      prisma.group.findUnique({
        where: { id: groupId },
        include: {
          studentGroups: {
            include: {
              student: true
            }
          }
        }
      }),
      prisma.gradeItem.findUnique({ where: { id: gradeItemId } })
    ]);

    if (!group) {
      return NextResponse.json(
        { error: '找不到分組' },
        { status: 404 }
      );
    }

    if (!gradeItem) {
      return NextResponse.json(
        { error: '找不到成績項目' },
        { status: 404 }
      );
    }

    if (score > gradeItem.maxScore) {
      return NextResponse.json(
        { error: `分數不能超過滿分 ${gradeItem.maxScore}` },
        { status: 400 }
      );
    }

    if (group.studentGroups.length === 0) {
      return NextResponse.json(
        { error: '此分組沒有成員' },
        { status: 400 }
      );
    }

    // 批次為所有組員登記成績
    const scoreValue = parseFloat(score.toString());
    const gradeOperations = group.studentGroups.map(sg =>
      prisma.grade.upsert({
        where: {
          studentId_gradeItemId: {
            studentId: sg.studentId,
            gradeItemId
          }
        },
        update: {
          score: scoreValue
        },
        create: {
          studentId: sg.studentId,
          gradeItemId,
          score: scoreValue
        }
      })
    );

    const grades = await prisma.$transaction(gradeOperations);

    return NextResponse.json({
      success: true,
      message: `已為 ${group.name} 的 ${grades.length} 位成員登記成績`,
      affectedStudents: grades.length,
      groupName: group.name,
      gradeItemName: gradeItem.name,
      score: scoreValue
    }, { status: 201 });

  } catch (error) {
    console.error('登記分組成績錯誤:', error);

    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    const errorStack = error instanceof Error ? error.stack : '';

    return NextResponse.json(
      {
        error: '登記分組成績失敗',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
