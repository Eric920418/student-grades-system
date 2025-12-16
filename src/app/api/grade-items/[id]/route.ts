import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - 獲取單一成績項目詳細信息
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gradeItem = await prisma.gradeItem.findUnique({
      where: {
        id: params.id
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        grades: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                studentId: true,
                email: true,
                class: true
              }
            }
          },
          orderBy: {
            student: {
              studentId: 'asc'
            }
          }
        }
      }
    });

    if (!gradeItem) {
      return NextResponse.json(
        { error: '找不到該成績項目' },
        { status: 404 }
      );
    }

    return NextResponse.json(gradeItem);
  } catch (error) {
    console.error('獲取成績項目詳細信息錯誤:', error);
    return NextResponse.json(
      {
        error: '獲取成績項目詳細信息失敗',
        details: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}

// DELETE - 刪除成績項目
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 先檢查成績項目是否存在
    const gradeItem = await prisma.gradeItem.findUnique({
      where: {
        id: params.id
      },
      include: {
        grades: true,
        course: {
          select: {
            name: true
          }
        }
      }
    });

    if (!gradeItem) {
      return NextResponse.json(
        { error: '找不到該成績項目' },
        { status: 404 }
      );
    }

    // 檢查是否有已登記的成績
    const gradeCount = gradeItem.grades.length;

    // 刪除成績項目（會級聯刪除相關的成績記錄）
    await prisma.gradeItem.delete({
      where: {
        id: params.id
      }
    });

    return NextResponse.json({
      success: true,
      message: `成績項目「${gradeItem.name}」已刪除`,
      deletedGradesCount: gradeCount,
      courseName: gradeItem.course.name
    });
  } catch (error) {
    console.error('刪除成績項目錯誤:', error);

    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    const errorStack = error instanceof Error ? error.stack : '';

    return NextResponse.json(
      {
        error: '刪除成績項目失敗',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
