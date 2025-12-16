import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    // 建立查詢條件
    const whereCondition: any = {};

    if (courseId) {
      // 透過 student 關聯篩選課程
      whereCondition.student = {
        courseId: courseId
      };
    }

    const grades = await prisma.grade.findMany({
      where: whereCondition,
      include: {
        student: {
          include: {
            course: {
              select: {
                name: true,
                code: true
              }
            }
          }
        },
        gradeItem: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(grades);
  } catch (error) {
    console.error('獲取成績列表錯誤:', error);
    return NextResponse.json(
      { error: '獲取成績列表失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, gradeItemId, score } = body;

    if (!studentId || !gradeItemId || score === undefined || score === null) {
      return NextResponse.json(
        { error: '學生、成績項目和分數為必填欄位' },
        { status: 400 }
      );
    }

    if (score < 0) {
      return NextResponse.json(
        { error: '分數不能為負數' },
        { status: 400 }
      );
    }

    // 檢查學生和成績項目是否存在
    const [student, gradeItem] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId } }),
      prisma.gradeItem.findUnique({ where: { id: gradeItemId } })
    ]);

    if (!student) {
      return NextResponse.json(
        { error: '找不到學生' },
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

    // 使用 upsert 來處理新增或更新
    const grade = await prisma.grade.upsert({
      where: {
        studentId_gradeItemId: {
          studentId,
          gradeItemId
        }
      },
      update: {
        score: parseFloat(score.toString())
      },
      create: {
        studentId,
        gradeItemId,
        score: parseFloat(score.toString())
      },
      include: {
        student: true,
        gradeItem: true
      }
    });

    return NextResponse.json(grade, { status: 201 });
  } catch (error) {
    console.error('登記成績錯誤:', error);
    return NextResponse.json(
      { error: '登記成績失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}