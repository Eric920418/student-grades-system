import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { DEFAULT_FILL_CONFIG } from '@/lib/portalSync';

// 觸發 GitHub Actions worker 去 portalx 自動填分。
// 流程：組 { 學號: 分數 } → 建 PortalUploadJob(pending) → 呼叫 GitHub repository_dispatch。
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
    } = body as {
      courseId?: string;
      gradeItemId?: string;
      dryRun?: boolean;
      fillUnrecordedZero?: boolean;
    };

    if (!courseId || !gradeItemId) {
      return NextResponse.json({ error: '缺少 courseId 或 gradeItemId' }, { status: 400 });
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
    const ghRes = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'portal-upload',
        client_payload: {
          jobId: job.id,
          gradeItemName: gradeItem.name,
          scoreMap,
          dryRun,
          fillConfig: DEFAULT_FILL_CONFIG,
        },
      }),
    });

    if (!ghRes.ok) {
      const text = await ghRes.text();
      // 觸發失敗 → 任務標記 failed，錯誤完整回前端
      await prisma.portalUploadJob.update({
        where: { id: job.id },
        data: { status: 'failed', message: `GitHub 觸發失敗 (${ghRes.status}): ${text}` },
      });
      return NextResponse.json(
        { error: 'GitHub Actions 觸發失敗', details: `HTTP ${ghRes.status}: ${text}` },
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
