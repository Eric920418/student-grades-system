import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { students } = body;

    if (!Array.isArray(students)) {
      return NextResponse.json(
        { error: '學生資料格式錯誤' },
        { status: 400 }
      );
    }

    // 驗證學生資料格式
    for (const student of students) {
      if (!student.id || typeof student.id !== 'string') {
        return NextResponse.json(
          { error: '學生ID格式錯誤' },
          { status: 400 }
        );
      }
      if (student.role && !['導演', '模型', '後製', '動畫'].includes(student.role)) {
        return NextResponse.json(
          { error: `不支援的職位: ${student.role}` },
          { status: 400 }
        );
      }
    }

    // 檢查分組是否存在
    const group = await prisma.group.findUnique({
      where: { id: params.id }
    });

    if (!group) {
      return NextResponse.json(
        { error: '找不到分組' },
        { status: 404 }
      );
    }

    // 檢查所有學生是否存在
    const studentIds = students.map(s => s.id);
    const existingStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds }
      }
    });

    if (existingStudents.length !== studentIds.length) {
      return NextResponse.json(
        { error: '部分學生不存在' },
        { status: 400 }
      );
    }

    // 先刪除現有的分組關係
    await prisma.studentGroup.deleteMany({
      where: { groupId: params.id }
    });

    // 批量創建新的分組關係（包含職位）
    if (students.length > 0) {
      await prisma.studentGroup.createMany({
        data: students.map((student: { id: string; role?: string }) => ({
          studentId: student.id,
          groupId: params.id,
          role: student.role || null
        }))
      });
    }

    // 返回更新後的分組資訊
    const updatedGroup = await prisma.group.findUnique({
      where: { id: params.id },
      include: {
        studentGroups: {
          include: {
            student: true
          }
        }
      }
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error('分配學生到分組錯誤:', error);
    return NextResponse.json(
      { error: '分配學生失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}