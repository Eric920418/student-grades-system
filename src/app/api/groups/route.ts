import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseFilter = searchParams.get('courseId');
    
    const whereClause: any = {};
    if (courseFilter) whereClause.courseId = courseFilter;
    
    const groups = await prisma.group.findMany({
      where: whereClause,
      include: {
        course: true,
        studentGroups: {
          include: {
            student: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(groups);
  } catch (error) {
    console.error('獲取分組列表錯誤:', error);
    return NextResponse.json(
      { error: '獲取分組列表失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseId, students } = body;

    if (!courseId) {
      return NextResponse.json(
        { error: '課程ID為必填欄位' },
        { status: 400 }
      );
    }

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { error: '請至少選擇一位學生' },
        { status: 400 }
      );
    }

    // 檢查課程是否存在
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return NextResponse.json(
        { error: '課程不存在' },
        { status: 400 }
      );
    }

    // 檢查學生是否存在
    const studentIds = students.map(s => s.studentId);
    const existingStudents = await prisma.student.findMany({
      where: { id: { in: studentIds } }
    });

    if (existingStudents.length !== studentIds.length) {
      return NextResponse.json(
        { error: '部分學生不存在' },
        { status: 400 }
      );
    }

    // 檢查學生是否已在其他組別（同一課程內）
    const existingGroupAssignments = await prisma.studentGroup.findMany({
      where: {
        studentId: { in: studentIds },
        group: {
          courseId: courseId
        }
      },
      include: {
        student: true,
        group: true
      }
    });

    if (existingGroupAssignments.length > 0) {
      const duplicateStudents = existingGroupAssignments.map(sg => 
        `${sg.student.name}（${sg.student.studentId}）已在${sg.group.name}`
      );
      return NextResponse.json(
        { error: `無法新增分組，以下學生已有組別：\n${duplicateStudents.join('\n')}` },
        { status: 400 }
      );
    }

    // 生成分組名稱（找出下一個可用的組號）
    const existingGroups = await prisma.group.findMany({
      where: { courseId: courseId },
      select: { name: true }
    });
    
    // 找出已存在的組號
    const existingNumbers = existingGroups
      .map(g => g.name.match(/第(\d+)組/))
      .filter(match => match !== null)
      .map(match => parseInt(match![1]))
      .sort((a, b) => a - b);
    
    // 找出下一個可用的組號
    let nextNumber = 1;
    for (const num of existingNumbers) {
      if (num === nextNumber) {
        nextNumber++;
      } else {
        break;
      }
    }
    
    const groupName = `第${nextNumber}組`;

    // 創建分組和學生關係
    const group = await prisma.group.create({
      data: {
        name: groupName,
        courseId: courseId,
        studentGroups: {
          create: students.map(student => ({
            studentId: student.studentId,
            role: student.role
          }))
        }
      },
      include: {
        course: true,
        studentGroups: {
          include: {
            student: true
          }
        }
      }
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error('創建分組錯誤:', error);
    return NextResponse.json(
      { error: '創建分組失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}