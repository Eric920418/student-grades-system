import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { DEFAULT_FILL_CONFIG } from '@/lib/portalSync';

// 呼叫 GitHub repository_dispatch 觸發 worker。回傳結果供呼叫端處理失敗。
async function callRepositoryDispatch(
  repo: string,
  token: string,
  clientPayload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ event_type: 'portal-upload', client_payload: clientPayload }),
  });
  return { ok: res.ok, status: res.status, text: res.ok ? '' : await res.text() };
}

// 觸發 GitHub Actions worker 去 portalx：mode='grades' 自動填分、mode='roster' 自動撈名單。
export async function POST(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const body = await request.json();
    const {
      courseId,
      gradeItemId,
      dryRun = true,
      fillUnrecordedZero = false,
      mode = 'grades',
    } = body as {
      courseId?: string;
      gradeItemId?: string;
      dryRun?: boolean;
      fillUnrecordedZero?: boolean;
      mode?: 'grades' | 'roster' | 'discover';
    };

    if (mode !== 'discover' && !courseId) {
      return NextResponse.json({ error: '缺少 courseId' }, { status: 400 });
    }

    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_DISPATCH_TOKEN;
    if (!repo || !token) {
      return NextResponse.json(
        {
          error: '尚未設定 GitHub 觸發環境變數',
          details: '請在 Vercel 設定 GITHUB_REPO（如 Eric920418/student-grades-system）與 GITHUB_DISPATCH_TOKEN（fine-grained PAT，限本 repo、Actions read/write）',
        },
        { status: 500 }
      );
    }

    // === 課程發現模式（唯讀，不需 courseId）===
    if (mode === 'discover') {
      const job = await prisma.portalUploadJob.create({
        data: { kind: 'discover', status: 'pending', dryRun: true },
      });
      const ghRes = await callRepositoryDispatch(repo, token, { mode: 'discover', jobId: job.id });
      if (!ghRes.ok) {
        await prisma.portalUploadJob.update({
          where: { id: job.id },
          data: { status: 'failed', message: `GitHub 觸發失敗 (${ghRes.status}): ${ghRes.text}` },
        });
        return NextResponse.json(
          { error: 'GitHub Actions 觸發失敗', details: `HTTP ${ghRes.status}: ${ghRes.text}` },
          { status: 502 }
        );
      }
      return NextResponse.json({ jobId: job.id, mode: 'discover' });
    }

    // === 名單同步模式 ===
    if (mode === 'roster') {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return NextResponse.json({ error: '課程不存在' }, { status: 404 });
      if (!course.portalCosId || !course.portalYear || !course.portalSemester) {
        return NextResponse.json(
          {
            error: '此課程尚未設定 portal 對應',
            details: '請先在「校務同步」頁填寫此課程的 portal 課號、學年、學期',
          },
          { status: 400 }
        );
      }
      const classes = course.hasClassDivision ? ['A', 'B'] : ['A'];
      const job = await prisma.portalUploadJob.create({
        data: { kind: 'roster', courseId, status: 'pending', dryRun },
      });
      const ghRes = await callRepositoryDispatch(repo, token, {
        mode: 'roster',
        jobId: job.id,
        courseId,
        portal: {
          cosId: course.portalCosId,
          year: course.portalYear,
          semester: course.portalSemester,
          classes,
        },
        dryRun,
      });
      if (!ghRes.ok) {
        await prisma.portalUploadJob.update({
          where: { id: job.id },
          data: { status: 'failed', message: `GitHub 觸發失敗 (${ghRes.status}): ${ghRes.text}` },
        });
        return NextResponse.json(
          { error: 'GitHub Actions 觸發失敗', details: `HTTP ${ghRes.status}: ${ghRes.text}` },
          { status: 502 }
        );
      }
      return NextResponse.json({ jobId: job.id, mode: 'roster', classes });
    }

    // === 成績上傳模式 ===
    if (!gradeItemId) {
      return NextResponse.json({ error: '缺少 gradeItemId' }, { status: 400 });
    }

    // 取成績項目與已登記成績
    const gradeItem = await prisma.gradeItem.findUnique({
      where: { id: gradeItemId },
      include: {
        grades: { include: { student: { select: { studentId: true } } } },
      },
    });
    if (!gradeItem) {
      return NextResponse.json({ error: '找不到該成績項目' }, { status: 404 });
    }

    // 組 { 學號: 分數 }
    const scoreMap: Record<string, number> = {};
    for (const g of gradeItem.grades) {
      scoreMap[g.student.studentId] = g.score;
    }
    // 未登記者填 0（選用）：補上課程中尚未登記成績的學生
    if (fillUnrecordedZero) {
      const students = await prisma.student.findMany({
        where: { courseId },
        select: { studentId: true },
      });
      for (const s of students) {
        if (!(s.studentId in scoreMap)) scoreMap[s.studentId] = 0;
      }
    }

    const totalCount = Object.keys(scoreMap).length;
    if (totalCount === 0) {
      return NextResponse.json(
        { error: '此成績項目沒有可上傳的成績（尚未登記任何分數）' },
        { status: 400 }
      );
    }

    // 建立任務紀錄
    const job = await prisma.portalUploadJob.create({
      data: {
        courseId,
        gradeItemId,
        gradeItemName: gradeItem.name,
        status: 'pending',
        dryRun,
        totalCount,
      },
    });

    // 觸發 GitHub Actions（repository_dispatch）
    const ghRes = await callRepositoryDispatch(repo, token, {
      mode: 'grades',
      jobId: job.id,
      gradeItemName: gradeItem.name,
      scoreMap,
      dryRun,
      fillConfig: DEFAULT_FILL_CONFIG,
    });

    if (!ghRes.ok) {
      // 觸發失敗 → 任務標記 failed，錯誤完整回前端
      await prisma.portalUploadJob.update({
        where: { id: job.id },
        data: { status: 'failed', message: `GitHub 觸發失敗 (${ghRes.status}): ${ghRes.text}` },
      });
      return NextResponse.json(
        { error: 'GitHub Actions 觸發失敗', details: `HTTP ${ghRes.status}: ${ghRes.text}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ jobId: job.id, totalCount, dryRun });
  } catch (error) {
    console.error('觸發自動上傳錯誤:', error);
    return NextResponse.json(
      { error: '觸發自動上傳失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}
