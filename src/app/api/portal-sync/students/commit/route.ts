import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import type { ImportRow } from '@/lib/portalSync';

interface UpdateItem {
  studentId: string;
  fields: { name?: string; class?: string; email?: string };
}

/**
 * 確認匯入：實際寫入，但只做老師明確同意的操作。
 *   - create：新增 DB 中不存在的學生（transaction 內二次確認不存在才建，防並發）
 *   - update：只更新老師逐列勾選的欄位（部分更新，絕不整列覆蓋）
 * 完整回傳 { created, updated, skipped, errors } 供前端顯示。
 */
export async function POST(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const body = await request.json();
    const {
      courseId,
      create = [],
      update = [],
    } = body as { courseId?: string; create?: ImportRow[]; update?: UpdateItem[] };

    if (!courseId) {
      return NextResponse.json({ error: '缺少 courseId' }, { status: 400 });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json({ error: '課程不存在' }, { status: 400 });
    }

    const result = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

    await prisma.$transaction(async (tx) => {
      // 新增
      for (const row of create) {
        const studentId = (row.studentId || '').trim();
        if (!studentId || !row.name) {
          result.errors.push(`${studentId || '(空學號)'}：缺少學號或姓名，略過`);
          result.skipped++;
          continue;
        }
        const existing = await tx.student.findUnique({
          where: { studentId_courseId: { studentId, courseId } },
        });
        if (existing) {
          // 二次確認：預覽後到此之間若已被建立，略過避免覆蓋
          result.skipped++;
          continue;
        }
        await tx.student.create({
          data: {
            studentId,
            name: row.name,
            email: row.email?.trim() || null,
            class: row.class?.trim() || 'A',
            courseId,
          },
        });
        // 同步建立登入帳號（已停用自助註冊，名單匯入是學生取得登入帳號的唯一途徑）。
        // 已存在則不覆蓋（update:{}），避免改動既有帳號的姓名/班級。
        await tx.account.upsert({
          where: { studentId },
          update: {},
          create: { studentId, name: row.name, class: row.class?.trim() || 'A' },
        });
        result.created++;
      }

      // 更新（只更新老師勾選的欄位）
      for (const item of update) {
        const studentId = (item.studentId || '').trim();
        const existing = await tx.student.findUnique({
          where: { studentId_courseId: { studentId, courseId } },
        });
        if (!existing) {
          result.errors.push(`${studentId}：更新時找不到該學生，略過`);
          result.skipped++;
          continue;
        }
        const data: Record<string, string> = {};
        if (item.fields.name?.trim()) data.name = item.fields.name.trim();
        if (item.fields.class?.trim()) data.class = item.fields.class.trim();
        if (item.fields.email?.trim()) data.email = item.fields.email.trim();
        if (Object.keys(data).length === 0) {
          result.skipped++;
          continue;
        }
        await tx.student.update({
          where: { studentId_courseId: { studentId, courseId } },
          data,
        });
        result.updated++;
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('匯入寫入錯誤:', error);
    return NextResponse.json(
      { error: '匯入寫入失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
