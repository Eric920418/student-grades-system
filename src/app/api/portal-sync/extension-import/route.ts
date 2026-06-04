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
      const baseName = c.name.trim();
      const year = (c.year || '').trim();
      const sem = (c.semester || '').trim();
      const cosClass = (c.cosClass || 'A').trim() || 'A';
      // 每學期各自獨立：以「課號+學年+學期」當課程身分；課名加學期後綴以利區分與避免同名衝突
      const displayName = year && sem ? `${baseName}（${year}-${sem}）` : baseName;

      // 找同一學期的同一門課（有學期就用課號+學年+學期；否則退回課號/課名）
      let course = await prisma.course.findFirst({
        where:
          year && sem
            ? { portalCosId: cosId, portalYear: year, portalSemester: sem }
            : { OR: [{ code: cosId }, { name: displayName }] },
      });
      if (course) {
        course = await prisma.course.update({
          where: { id: course.id },
          data: { portalCosId: cosId, portalYear: year || null, portalSemester: sem || null },
        });
        result.coursesUpdated++;
      } else {
        course = await prisma.course.create({
          data: {
            name: displayName,
            code: cosId,
            hasClassDivision: pick.hasClassDivision === true,
            portalCosId: cosId,
            portalYear: year || null,
            portalSemester: sem || null,
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
      result.courses.push({ name: displayName, created, skipped, conflicts });
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
