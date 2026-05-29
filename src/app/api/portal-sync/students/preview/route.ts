import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import type { ImportRow } from '@/lib/portalSync';

// 可比對覆蓋的欄位
const COMPARABLE_FIELDS = ['name', 'class', 'email'] as const;
type ComparableField = (typeof COMPARABLE_FIELDS)[number];

interface FieldDiff {
  field: ComparableField;
  dbValue: string | null;
  portalValue: string;
}

/**
 * 預覽匯入：只讀不寫。把貼上的名單與 DB 比對，分成
 *   - toCreate：DB 中不存在的學號
 *   - identical：存在且提供的欄位皆相同（預設略過）
 *   - conflicts：存在但有欄位差異，附差異明細交給老師逐列決定是否覆蓋
 */
export async function POST(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const body = await request.json();
    const { courseId, rows } = body as { courseId?: string; rows?: ImportRow[] };

    if (!courseId) {
      return NextResponse.json({ error: '缺少 courseId' }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '沒有可匯入的資料列' }, { status: 400 });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: '課程不存在' }, { status: 400 });
    }

    const toCreate: ImportRow[] = [];
    const identical: ImportRow[] = [];
    const conflicts: Array<{ row: ImportRow; diffs: FieldDiff[] }> = [];
    const invalid: Array<{ row: ImportRow; reason: string }> = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const studentId = (row.studentId || '').trim();
      if (!studentId) {
        invalid.push({ row, reason: '缺少學號' });
        continue;
      }
      if (seen.has(studentId)) {
        invalid.push({ row, reason: '貼上的資料中有重複學號' });
        continue;
      }
      seen.add(studentId);

      const existing = await prisma.student.findUnique({
        where: { studentId_courseId: { studentId, courseId } },
      });

      if (!existing) {
        toCreate.push({ ...row, studentId });
        continue;
      }

      const diffs: FieldDiff[] = [];
      for (const field of COMPARABLE_FIELDS) {
        const portalValue = (row[field] ?? '').toString().trim();
        if (!portalValue) continue; // 名單沒提供此欄就不比較
        const dbValue = (existing[field] ?? null) as string | null;
        if ((dbValue ?? '') !== portalValue) {
          diffs.push({ field, dbValue, portalValue });
        }
      }

      if (diffs.length === 0) {
        identical.push({ ...row, studentId });
      } else {
        conflicts.push({ row: { ...row, studentId }, diffs });
      }
    }

    return NextResponse.json({ toCreate, identical, conflicts, invalid });
  } catch (error) {
    console.error('匯入預覽錯誤:', error);
    return NextResponse.json(
      { error: '匯入預覽失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
