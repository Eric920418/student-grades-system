import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, getTokenCookieOptions } from '@/lib/auth';

// GET: 回傳可選課程列表（含是否有分班資訊）
export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      select: { id: true, name: true, code: true, hasClassDivision: true },
      orderBy: { name: 'asc' },
    });

    const coursesWithClassInfo = courses.map((c) => ({
      ...c,
      hasClassOptions: c.hasClassDivision,
    }));

    return NextResponse.json({ courses: coursesWithClassInfo });
  } catch (error) {
    console.error('取得課程列表錯誤:', error);
    return NextResponse.json(
      { error: '取得課程列表失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

// POST: 註冊帳號 + 自動加入所選課程
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, name, class: studentClass, courseId } = body;

    if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
      return NextResponse.json({ error: '請輸入學號' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '請輸入姓名' }, { status: 400 });
    }
    if (!courseId || typeof courseId !== 'string') {
      return NextResponse.json({ error: '請選擇課程' }, { status: 400 });
    }

    const trimmedId = studentId.trim();
    const trimmedName = name.trim();
    const validClass = studentClass === 'B' ? 'B' : 'A';

    // 確認課程存在
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: '課程不存在' }, { status: 404 });
    }

    // 檢查 Account 是否已存在
    const existingAccount = await prisma.account.findUnique({
      where: { studentId: trimmedId },
    });
    if (existingAccount) {
      return NextResponse.json({ error: '此學號已註冊' }, { status: 409 });
    }

    // 檢查 Student 表是否已有該學號（舊學生向下相容）
    const existingStudents = await prisma.student.findMany({
      where: { studentId: trimmedId },
      take: 1,
    });

    let account;
    let message: string;

    if (existingStudents.length > 0) {
      // 從已有的 Student 資料建立 Account
      const s = existingStudents[0];
      account = await prisma.account.create({
        data: {
          studentId: trimmedId,
          name: s.name,
          class: s.class,
        },
      });
      message = '帳號已自動建立（從既有學生資料）';
    } else {
      // 全新註冊：建立 Account + Student
      account = await prisma.account.create({
        data: {
          studentId: trimmedId,
          name: trimmedName,
          class: validClass,
        },
      });

      // 同時建立該課程的 Student 記錄
      await prisma.student.create({
        data: {
          studentId: trimmedId,
          name: trimmedName,
          class: validClass,
          courseId,
        },
      });

      message = `註冊成功，已加入「${course.name}」`;
    }

    // 簽發 JWT 自動登入
    const token = await signToken({
      role: 'student',
      studentId: trimmedId,
      name: account.name,
    });

    const cookieOptions = getTokenCookieOptions();
    const response = NextResponse.json({
      message,
      user: { role: 'student', studentId: trimmedId, name: account.name },
    });
    response.cookies.set(cookieOptions.name, token, cookieOptions);
    return response;
  } catch (error) {
    console.error('註冊錯誤:', error);
    return NextResponse.json(
      { error: '註冊失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
