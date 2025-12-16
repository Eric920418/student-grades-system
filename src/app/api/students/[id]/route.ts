import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        studentGroups: {
          include: {
            group: true
          }
        },
        grades: {
          include: {
            gradeItem: true
          }
        }
      }
    });

    if (!student) {
      return NextResponse.json(
        { error: '找不到學生' },
        { status: 404 }
      );
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error('獲取學生詳情錯誤:', error);
    return NextResponse.json(
      { error: '獲取學生詳情失敗', details: error instanceof Error ? error.message : '未知錯誤' },
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
    const { name, studentId, email, class: studentClass } = body;

    if (!name || !studentId) {
      return NextResponse.json(
        { error: '姓名和學號為必填欄位' },
        { status: 400 }
      );
    }

    const existingStudent = await prisma.student.findUnique({
      where: { 
        studentId,
        NOT: { id: params.id }
      }
    });

    if (existingStudent) {
      return NextResponse.json(
        { error: '學號已存在' },
        { status: 400 }
      );
    }

    const student = await prisma.student.update({
      where: { id: params.id },
      data: {
        name,
        studentId,
        email: email || null,
        ...(studentClass && { class: studentClass })
      }
    });

    return NextResponse.json(student);
  } catch (error) {
    console.error('更新學生錯誤:', error);
    return NextResponse.json(
      { error: '更新學生失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.student.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: '學生刪除成功' });
  } catch (error) {
    console.error('刪除學生錯誤:', error);
    return NextResponse.json(
      { error: '刪除學生失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}