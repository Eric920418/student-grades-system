import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// GET - 取得單一課程詳細資訊
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            students: true,
            groups: true,
            gradeItems: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: '找不到該課程' },
        { status: 404 }
      );
    }

    return NextResponse.json(course);
  } catch (error) {
    console.error('取得課程詳細資訊錯誤:', error);
    return NextResponse.json(
      { error: '取得課程詳細資訊失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

// PUT - 更新課程
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const existing = await prisma.course.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: '找不到該課程' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, code, description, hasClassDivision } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: '課程名稱為必填欄位' },
        { status: 400 }
      );
    }

    // 檢查名稱唯一性（排除自身）
    const duplicate = await prisma.course.findFirst({
      where: {
        name: name.trim(),
        id: { not: params.id },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: '課程名稱已存在' },
        { status: 400 }
      );
    }

    const course = await prisma.course.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        description: description?.trim() || null,
        hasClassDivision: typeof hasClassDivision === 'boolean' ? hasClassDivision : existing.hasClassDivision,
      },
    });

    return NextResponse.json(course);
  } catch (error) {
    console.error('更新課程錯誤:', error);
    return NextResponse.json(
      { error: '更新課程失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

// DELETE - 刪除課程
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            students: true,
            groups: true,
            gradeItems: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: '找不到該課程' },
        { status: 404 }
      );
    }

    // 查詢成績數量
    const gradesCount = await prisma.grade.count({
      where: {
        student: { courseId: params.id },
      },
    });

    // 刪除課程（級聯刪除所有關聯資料）
    await prisma.course.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: `課程「${course.name}」已刪除`,
      deleted: {
        students: course._count.students,
        groups: course._count.groups,
        gradeItems: course._count.gradeItems,
        grades: gradesCount,
      },
    });
  } catch (error) {
    console.error('刪除課程錯誤:', error);
    return NextResponse.json(
      { error: '刪除課程失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
