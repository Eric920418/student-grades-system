import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, getTokenCookieOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, name, class: studentClass } = body;

    if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
      return NextResponse.json({ error: '請輸入學號' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '請輸入姓名' }, { status: 400 });
    }

    const trimmedId = studentId.trim();
    const trimmedName = name.trim();
    const validClass = studentClass === 'B' ? 'B' : 'A';

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
      // 全新註冊
      account = await prisma.account.create({
        data: {
          studentId: trimmedId,
          name: trimmedName,
          class: validClass,
        },
      });
      message = '註冊成功';
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
