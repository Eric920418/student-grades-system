import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

interface Pick {
  name: string;
  cosId: string;
  year: string;
  semester: string;
  hasClassDivision?: boolean;
}

async function triggerRosterDispatch(
  repo: string,
  token: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event_type: 'portal-upload', client_payload: payload }),
  });
  return { ok: res.ok, status: res.status, text: res.ok ? '' : await res.text() };
}

// 依老師勾選的課程：建立/補對應 Course，並逐課觸發名單同步（乾跑）。
// 既有課程只補 portal 對應、不覆蓋其他欄位（守「不可覆蓋」）。
export async function POST(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const body = await request.json();
    const { picks } = body as { picks?: Pick[] };
    if (!Array.isArray(picks) || picks.length === 0) {
      return NextResponse.json({ error: '沒有勾選任何課程' }, { status: 400 });
    }

    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_DISPATCH_TOKEN;
    if (!repo || !token) {
      return NextResponse.json(
        { error: '尚未設定 GitHub 觸發環境變數', details: '請設定 GITHUB_REPO 與 GITHUB_DISPATCH_TOKEN' },
        { status: 500 }
      );
    }

    const created: string[] = [];
    const updated: string[] = [];
    const triggered: Array<{ course: string; jobId: string }> = [];
    const errors: string[] = [];

    for (const p of picks) {
      const cosId = (p.cosId || '').trim();
      const name = (p.name || '').trim();
      if (!cosId || !name) {
        errors.push(`${name || cosId || '(空)'}：缺少課名或課號`);
        continue;
      }

      // 找既有課程（先比 code=cosId，再比 name）
      let course = await prisma.course.findFirst({
        where: { OR: [{ code: cosId }, { name }] },
      });

      if (course) {
        // 只補 portal 對應，不動其他欄位
        course = await prisma.course.update({
          where: { id: course.id },
          data: { portalCosId: cosId, portalYear: p.year || null, portalSemester: p.semester || null },
        });
        updated.push(name);
      } else {
        course = await prisma.course.create({
          data: {
            name,
            code: cosId,
            hasClassDivision: p.hasClassDivision === true,
            portalCosId: cosId,
            portalYear: p.year || null,
            portalSemester: p.semester || null,
          },
        });
        created.push(name);
      }

      // 觸發名單同步（乾跑）
      const classes = course.hasClassDivision ? ['A', 'B'] : ['A'];
      const job = await prisma.portalUploadJob.create({
        data: { kind: 'roster', courseId: course.id, status: 'pending', dryRun: true },
      });
      const gh = await triggerRosterDispatch(repo, token, {
        mode: 'roster',
        jobId: job.id,
        courseId: course.id,
        portal: { cosId, year: p.year, semester: p.semester, classes },
        dryRun: true,
      });
      if (gh.ok) {
        triggered.push({ course: name, jobId: job.id });
      } else {
        await prisma.portalUploadJob.update({
          where: { id: job.id },
          data: { status: 'failed', message: `GitHub 觸發失敗 (${gh.status}): ${gh.text}` },
        });
        errors.push(`${name}：名單同步觸發失敗 ${gh.status}`);
      }
    }

    return NextResponse.json({
      created: created.length,
      updated: updated.length,
      triggered,
      errors,
    });
  } catch (error) {
    console.error('discover-import 錯誤:', error);
    return NextResponse.json(
      { error: '匯入課程失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
