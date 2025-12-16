import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      include: {
        _count: {
          select: {
            students: true,
            groups: true,
            gradeItems: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(courses);
  } catch (error) {
    console.error('獲取課程列表錯誤:', error);
    return NextResponse.json(
      { error: '獲取課程列表失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: '課程名稱為必填欄位' },
        { status: 400 }
      );
    }

    const existingCourse = await prisma.course.findUnique({
      where: { name }
    });

    if (existingCourse) {
      return NextResponse.json(
        { error: '課程名稱已存在' },
        { status: 400 }
      );
    }

    const course = await prisma.course.create({
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        description: description?.trim() || null
      }
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error('創建課程錯誤:', error);
    return NextResponse.json(
      { error: '創建課程失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}