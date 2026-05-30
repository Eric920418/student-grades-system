import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

interface ScrapedStudent {
  studentId: string;
  name: string;
  email?: string;
  withdrawn?: boolean;
}
interface ScrapedCourse {
  name: string;
  cosId?: string;
  cosClass?: string;
  year?: string;
  semester?: string;
  isInstructor?: boolean;
  students?: ScrapedStudent[];
  error?: string;
}

// 老師在 /portal-courses 勾選後，從插件已爬好的資料（存在 job.resultJson）建課＋寫名單。
// 只新增不覆蓋；建 Student 同時 account.upsert（學生可直接登入）；停修跳過。
export async function POST(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const body = await request.json();
    const { jobId, picks } = body as {
      jobId?: string;
      picks?: Array<{ index: number; hasClassDivision?: boolean }>;
    };
    if (!jobId || !Array.isArray(picks) || picks.length === 0) {
      return NextResponse.json({ error: '缺少 jobId 或未勾選課程' }, { status: 400 });
    }

    const job = await prisma.portalUploadJob.findUnique({ where: { id: jobId } });
    if (!job || !job.resultJson) {
      return NextResponse.json({ error: '找不到對應的爬取資料，請重新用插件同步' }, { status: 404 });
    }
    const courses = JSON.parse(job.resultJson) as ScrapedCourse[];

    const result: {
      courses: Array<{ name: string; created: number; skipped: number; conflicts: number }>;
      coursesCreated: number;
      coursesUpdated: number;
      errors: string[];
    } = { courses: [], coursesCreated: 0, coursesUpdated: 0, errors: [] };

    for (const pick of picks) {
      const c = courses[pick.index];
      if (!c || !c.cosId) {
        result.errors.push(`第 ${pick.index} 筆：缺少課號，略過`);
        continue;
      }
      const cosId = c.cosId.trim();
      const name = c.name.trim();
      const cosClass = (c.cosClass || 'A').trim() || 'A';

      // 建立/補對應 Course（既有只補 portal 對應，不覆蓋其他欄位）
      let course = await prisma.course.findFirst({ where: { OR: [{ code: cosId }, { name }] } });
      if (course) {
        course = await prisma.course.update({
          where: { id: course.id },
          data: { portalCosId: cosId, portalYear: c.year || null, portalSemester: c.semester || null },
        });
        result.coursesUpdated++;
      } else {
        course = await prisma.course.create({
          data: {
            name,
            code: cosId,
            hasClassDivision: pick.hasClassDivision === true,
            portalCosId: cosId,
            portalYear: c.year || null,
            portalSemester: c.semester || null,
          },
        });
        result.coursesCreated++;
      }

      // 寫名單（只新增不覆蓋、同建 Account、跳過停修）
      const courseId = course.id;
      let created = 0, skipped = 0, conflicts = 0;
      const students = (c.students || []).filter((s) => s && s.studentId && !s.withdrawn);
      await prisma.$transaction(async (tx) => {
        for (const s of students) {
          const studentId = s.studentId.trim();
          if (!studentId || !s.name) { skipped++; continue; }
          const existing = await tx.student.findUnique({
            where: { studentId_courseId: { studentId, courseId } },
          });
          if (existing) {
            // 既有：有差異才算 conflict（不覆蓋）
            const portalName = (s.name || '').trim();
            const portalEmail = (s.email || '').trim();
            if ((existing.name !== portalName && portalName) || ((existing.email || '') !== portalEmail && portalEmail)) {
              conflicts++;
            } else {
              skipped++;
            }
            continue;
          }
          await tx.student.create({
            data: { studentId, name: s.name.trim(), email: s.email?.trim() || null, class: cosClass, courseId },
          });
          await tx.account.upsert({
            where: { studentId },
            update: {},
            create: { studentId, name: s.name.trim(), class: cosClass },
          });
          created++;
        }
      });
      result.courses.push({ name, created, skipped, conflicts });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('插件匯入錯誤:', error);
    return NextResponse.json(
      { error: '匯入失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
