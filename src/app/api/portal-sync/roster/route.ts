import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { ImportRow } from '@/lib/portalSync';

// GitHub Actions worker 撈到 portalx 名單後回寫用。
// 呼叫者是 worker（無登入 cookie），以 x-worker-secret + WORKER_CALLBACK_SECRET 驗證。
function secretOk(provided: string | null): boolean {
  const expected = process.env.WORKER_CALLBACK_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const COMPARABLE_FIELDS = ['name', 'class', 'email'] as const;

export async function POST(request: NextRequest) {
  try {
    if (!secretOk(request.headers.get('x-worker-secret'))) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, courseId, rows, dryRun = false } = body as {
      jobId?: string;
      courseId?: string;
      rows?: ImportRow[];
      dryRun?: boolean;
    };

    if (!courseId || !Array.isArray(rows)) {
      return NextResponse.json({ error: '缺少 courseId 或 rows' }, { status: 400 });
    }

    const created: string[] = [];
    const conflicts: string[] = []; // 已存在且有欄位差異的學號（不自動覆蓋）
    const skipped: string[] = []; // 已存在且相同
    const errors: string[] = [];
    const seen = new Set<string>();

    // 不用無腦 upsert：只「新增」缺少的，既有資料一律不覆蓋（差異列為衝突交老師檢視）
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const studentId = (row.studentId || '').trim();
        if (!studentId || !row.name) {
          errors.push(`${studentId || '(空學號)'}：缺少學號或姓名`);
          continue;
        }
        if (seen.has(studentId)) continue;
        seen.add(studentId);

        const existing = await tx.student.findUnique({
          where: { studentId_courseId: { studentId, courseId } },
        });

        if (!existing) {
          if (!dryRun) {
            await tx.student.create({
              data: {
                studentId,
                name: row.name,
                email: row.email?.trim() || null,
                class: row.class?.trim() || 'A',
                courseId,
              },
            });
            // 同步建立登入帳號（名單匯入是學生取得登入帳號的唯一途徑），已存在不覆蓋
            await tx.account.upsert({
              where: { studentId },
              update: {},
              create: { studentId, name: row.name, class: row.class?.trim() || 'A' },
            });
          }
          created.push(studentId);
          continue;
        }

        // 已存在 → 比對是否有差異
        let differs = false;
        for (const f of COMPARABLE_FIELDS) {
          const portalVal = (row[f] ?? '').toString().trim();
          if (!portalVal) continue;
          if (((existing[f] ?? '') as string) !== portalVal) differs = true;
        }
        if (differs) conflicts.push(studentId);
        else skipped.push(studentId);
      }
    });

    const message =
      `${dryRun ? '(乾跑，未寫入) ' : ''}新增 ${created.length}、` +
      `相同略過 ${skipped.length}、需檢視差異 ${conflicts.length}` +
      (conflicts.length ? `（${conflicts.join(', ')}）` : '') +
      (errors.length ? `；錯誤 ${errors.length}：${errors.join('；')}` : '');

    if (jobId) {
      await prisma.portalUploadJob.update({
        where: { id: jobId },
        data: {
          status: 'success',
          filledCount: created.length,
          totalCount: rows.length,
          message,
        },
      });
    }

    return NextResponse.json({
      created: created.length,
      skipped: skipped.length,
      conflicts,
      errors,
      message,
    });
  } catch (error) {
    console.error('名單回寫錯誤:', error);
    return NextResponse.json(
      { error: '名單回寫失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
