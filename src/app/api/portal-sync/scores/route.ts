import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

// 插件「填成績」用：回某課程某成績項目的 { 學號: 分數 }。
function tokenOk(provided: string | null): boolean {
  const expected = process.env.EXTENSION_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    if (!tokenOk(request.headers.get('x-extension-token'))) {
      return NextResponse.json({ error: '未授權（配對 token 不符）' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, gradeItemId, fillUnrecordedZero = false } = body as {
      courseId?: string;
      gradeItemId?: string;
      fillUnrecordedZero?: boolean;
    };
    if (!courseId || !gradeItemId) {
      return NextResponse.json({ error: '缺少 courseId 或 gradeItemId' }, { status: 400 });
    }

    const gradeItem = await prisma.gradeItem.findFirst({
      where: { id: gradeItemId, courseId },
      include: { grades: { include: { student: { select: { studentId: true } } } } },
    });
    if (!gradeItem) {
      return NextResponse.json({ error: '找不到該成績項目（或不屬於此課程）' }, { status: 404 });
    }

    const scoreMap: Record<string, number> = {};
    for (const g of gradeItem.grades) scoreMap[g.student.studentId] = g.score;

    if (fillUnrecordedZero) {
      const students = await prisma.student.findMany({ where: { courseId }, select: { studentId: true } });
      for (const s of students) if (!(s.studentId in scoreMap)) scoreMap[s.studentId] = 0;
    }

    return NextResponse.json({
      scoreMap,
      gradeItemName: gradeItem.name,
      maxScore: gradeItem.maxScore,
      count: Object.keys(scoreMap).length,
    });
  } catch (error) {
    console.error('取得分數錯誤:', error);
    return NextResponse.json(
      { error: '取得分數失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
