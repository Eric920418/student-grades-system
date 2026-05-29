import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: 回傳課程列表（保留給其他用途；自助註冊已停用）
export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      select: { id: true, name: true, code: true, hasClassDivision: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ courses });
  } catch (error) {
    console.error('取得課程列表錯誤:', error);
    return NextResponse.json(
      { error: '取得課程列表失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

// POST: 已停用自助註冊。學生帳號改由老師從校務系統(portalx)匯入名單時建立。
export async function POST() {
  return NextResponse.json(
    {
      error: '已停用自助註冊',
      details: '學生名單改由老師從校務系統匯入後自動建立，請聯絡授課老師。',
    },
    { status: 403 }
  );
}
