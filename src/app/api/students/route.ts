import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classFilter = searchParams.get('class');
    const courseFilter = searchParams.get('courseId');
    
    const whereClause: any = {};
    if (classFilter) whereClause.class = classFilter;
    if (courseFilter) whereClause.courseId = courseFilter;
    
    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        course: true,
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(students);
  } catch (error) {
    console.error('獲取學生列表錯誤:', error);
    return NextResponse.json(
      { error: '獲取學生列表失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, studentId, email, class: studentClass = 'A', courseId } = body;

    if (!name || !studentId) {
      return NextResponse.json(
        { error: '姓名和學號為必填欄位' },
        { status: 400 }
      );
    }

    if (!courseId) {
      return NextResponse.json(
        { error: '課程為必填欄位' },
        { status: 400 }
      );
    }

    const existingStudent = await prisma.student.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId
        }
      }
    });

    if (existingStudent) {
      return NextResponse.json(
        { error: '該學號在此課程中已存在' },
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

    const student = await prisma.student.create({
      data: {
        name,
        studentId,
        email: email || null,
        class: studentClass,
        courseId
      }
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error('創建學生錯誤:', error);
    return NextResponse.json(
      { error: '創建學生失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}