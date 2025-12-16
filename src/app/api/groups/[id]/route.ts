import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: params.id },
      include: {
        studentGroups: {
          include: {
            student: true
          }
        }
      }
    });

    if (!group) {
      return NextResponse.json(
        { error: '找不到分組' },
        { status: 404 }
      );
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error('獲取分組詳情錯誤:', error);
    return NextResponse.json(
      { error: '獲取分組詳情失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: '分組名稱為必填欄位' },
        { status: 400 }
      );
    }

    // 先獲取當前分組的 courseId
    const currentGroup = await prisma.group.findUnique({
      where: { id: params.id }
    });

    if (!currentGroup) {
      return NextResponse.json(
        { error: '找不到分組' },
        { status: 404 }
      );
    }

    // 檢查同課程內是否有其他同名分組
    const existingGroup = await prisma.group.findFirst({
      where: {
        name: name.trim(),
        courseId: currentGroup.courseId,
        NOT: { id: params.id }
      }
    });

    if (existingGroup) {
      return NextResponse.json(
        { error: '分組名稱已存在' },
        { status: 400 }
      );
    }

    const group = await prisma.group.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        description: description?.trim() || null
      }
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error('更新分組錯誤:', error);
    return NextResponse.json(
      { error: '更新分組失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.group.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: '分組刪除成功' });
  } catch (error) {
    console.error('刪除分組錯誤:', error);
    return NextResponse.json(
      { error: '刪除分組失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}