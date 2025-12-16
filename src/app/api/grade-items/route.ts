import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    // 如果沒有指定 courseId，返回錯誤提示
    if (!courseId) {
      return NextResponse.json(
        { error: '請指定課程 ID', details: '成績項目必須關聯到課程，請提供 courseId 參數' },
        { status: 400 }
      );
    }

    const gradeItems = await prisma.gradeItem.findMany({
      where: {
        courseId: courseId
      },
      include: {
        course: {
          select: {
            name: true,
            code: true
          }
        },
        grades: {
          include: {
            student: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(gradeItems);
  } catch (error) {
    console.error('獲取成績項目列表錯誤:', error);
    return NextResponse.json(
      { error: '獲取成績項目列表失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, weight, maxScore, courseId } = body;

    // 驗證必填欄位
    if (!name) {
      return NextResponse.json(
        { error: '項目名稱為必填欄位' },
        { status: 400 }
      );
    }

    if (!courseId) {
      return NextResponse.json(
        { error: '課程 ID 為必填欄位' },
        { status: 400 }
      );
    }

    // 驗證課程是否存在
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return NextResponse.json(
        { error: '指定的課程不存在' },
        { status: 404 }
      );
    }

    if (weight && (weight < 0 || weight > 1)) {
      return NextResponse.json(
        { error: '權重必須在0到1之間' },
        { status: 400 }
      );
    }

    if (maxScore && maxScore <= 0) {
      return NextResponse.json(
        { error: '滿分必須大於0' },
        { status: 400 }
      );
    }

    // 使用正確的複合唯一索引查詢
    const existingItem = await prisma.gradeItem.findUnique({
      where: {
        name_courseId: {
          name: name.trim(),
          courseId: courseId
        }
      }
    });

    if (existingItem) {
      return NextResponse.json(
        { error: `在課程「${course.name}」中，項目名稱「${name}」已存在` },
        { status: 400 }
      );
    }

    const gradeItem = await prisma.gradeItem.create({
      data: {
        name: name.trim(),
        weight: weight || 1.0,
        maxScore: maxScore || 100.0,
        courseId: courseId
      },
      include: {
        course: true
      }
    });

    return NextResponse.json(gradeItem, { status: 201 });
  } catch (error) {
    console.error('創建成績項目錯誤:', error);

    // 完整錯誤信息返回前端
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    const errorStack = error instanceof Error ? error.stack : '';

    return NextResponse.json(
      {
        error: '創建成績項目失敗',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}