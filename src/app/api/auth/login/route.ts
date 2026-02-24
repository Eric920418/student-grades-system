import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, validateAdmin, getTokenCookieOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, studentId, username, password } = body;

    if (type === 'student') {
      // 學生登入：先查 Account，再查 Student（向下相容）
      if (!studentId || typeof studentId !== 'string') {
        return NextResponse.json({ error: '請輸入學號' }, { status: 400 });
      }

      const trimmedId = studentId.trim();

      // 1. 先查 Account 表
      const account = await prisma.account.findUnique({
        where: { studentId: trimmedId },
      });

      if (account) {
        const token = await signToken({
          role: 'student',
          studentId: trimmedId,
          name: account.name,
        });
        const cookieOptions = getTokenCookieOptions();
        const response = NextResponse.json({
          user: { role: 'student', studentId: trimmedId, name: account.name },
        });
        response.cookies.set(cookieOptions.name, token, cookieOptions);
        return response;
      }

      // 2. Account 沒有但 Student 有 → 自動建立 Account（向下相容舊學生）
      const students = await prisma.student.findMany({
        where: { studentId: trimmedId },
        take: 1,
      });

      if (students.length > 0) {
        const s = students[0];
        await prisma.account.create({
          data: {
            studentId: trimmedId,
            name: s.name,
            class: s.class,
          },
        });

        const token = await signToken({
          role: 'student',
          studentId: trimmedId,
          name: s.name,
        });
        const cookieOptions = getTokenCookieOptions();
        const response = NextResponse.json({
          user: { role: 'student', studentId: trimmedId, name: s.name },
        });
        response.cookies.set(cookieOptions.name, token, cookieOptions);
        return response;
      }

      // 3. 都沒有
      return NextResponse.json({ error: '學號不存在，請先註冊' }, { status: 401 });
    }

    if (type === 'admin') {
      // 老師登入
      if (!username || !password) {
        return NextResponse.json({ error: '請輸入帳號和密碼' }, { status: 400 });
      }

      if (!validateAdmin(username, password)) {
        return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 });
      }

      const token = await signToken({ role: 'admin', name: '老師' });

      const cookieOptions = getTokenCookieOptions();
      const response = NextResponse.json({
        user: { role: 'admin', name: '老師' },
      });
      response.cookies.set(cookieOptions.name, token, cookieOptions);
      return response;
    }

    return NextResponse.json({ error: '無效的登入類型' }, { status: 400 });
  } catch (error) {
    console.error('登入錯誤:', error);
    return NextResponse.json(
      { error: '登入失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
