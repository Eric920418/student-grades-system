import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { getUserFromHeaders } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST：上傳完成後由前端呼叫，寫入 blob 元資料到 DB
// （不使用 Vercel Blob 的 onUploadCompleted webhook，因為本地 localhost 無法接收）
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromHeaders(request);
    if (!user || user.role !== 'student' || !user.studentId) {
      return NextResponse.json({ error: '請先登入學生帳號' }, { status: 401 });
    }
    const studentIdFromHeader = user.studentId;

    const body = await request.json();
    const { groupId, blobUrl, fileName } = body as {
      groupId?: string;
      blobUrl?: string;
      fileName?: string;
    };

    if (!groupId) {
      return NextResponse.json({ error: '缺少 groupId' }, { status: 400 });
    }
    if (!blobUrl) {
      return NextResponse.json({ error: '缺少 blobUrl' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(blobUrl);
    } catch {
      return NextResponse.json({ error: 'blobUrl 不是合法 URL' }, { status: 400 });
    }
    if (!parsedUrl.hostname.endsWith('.public.blob.vercel-storage.com')) {
      return NextResponse.json(
        { error: 'blobUrl 必須為 Vercel Blob 網域' },
        { status: 400 }
      );
    }
    const expectedPrefix = `/reports/${groupId}/`;
    if (!parsedUrl.pathname.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: `blobUrl 路徑必須以 ${expectedPrefix} 開頭（防止跨組覆蓋）` },
        { status: 400 }
      );
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, courseId: true, reportUrl: true },
    });
    if (!group) {
      return NextResponse.json({ error: '找不到指定的組別' }, { status: 404 });
    }

    const studentGroup = await prisma.studentGroup.findFirst({
      where: {
        groupId,
        student: {
          studentId: studentIdFromHeader,
          courseId: group.courseId,
        },
        isLeader: true,
      },
    });
    if (!studentGroup) {
      return NextResponse.json(
        { error: '只有組長可以更新報告' },
        { status: 403 }
      );
    }

    if (group.reportUrl && group.reportUrl !== blobUrl) {
      try {
        await del(group.reportUrl);
      } catch (e) {
        console.error('刪除舊 blob 失敗（仍繼續寫入新 URL）:', e);
      }
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        reportUrl: blobUrl,
        reportFileName: fileName || null,
        reportUploadedAt: new Date(),
        reportUploadedById: studentIdFromHeader,
      },
      select: {
        id: true,
        reportUrl: true,
        reportFileName: true,
        reportUploadedAt: true,
        reportUploadedById: true,
      },
    });

    return NextResponse.json({ success: true, group: updated });
  } catch (error) {
    console.error('記錄上傳完成 API 錯誤:', error);
    return NextResponse.json(
      {
        error: '記錄上傳失敗',
        details: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 }
    );
  }
}

// DELETE：組長刪除自己組的報告
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromHeaders(request);
    if (!user || user.role !== 'student' || !user.studentId) {
      return NextResponse.json({ error: '請先登入學生帳號' }, { status: 401 });
    }

    const body = await request.json();
    const { groupId } = body as { groupId?: string };
    if (!groupId) {
      return NextResponse.json({ error: '缺少 groupId' }, { status: 400 });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, courseId: true, reportUrl: true },
    });
    if (!group) {
      return NextResponse.json({ error: '找不到指定的組別' }, { status: 404 });
    }

    const studentGroup = await prisma.studentGroup.findFirst({
      where: {
        groupId,
        student: {
          studentId: user.studentId,
          courseId: group.courseId,
        },
        isLeader: true,
      },
    });
    if (!studentGroup) {
      return NextResponse.json(
        { error: '只有組長可以刪除報告（老師請使用 /api/groups/[id]/report）' },
        { status: 403 }
      );
    }

    if (group.reportUrl) {
      try {
        await del(group.reportUrl);
      } catch (e) {
        console.error('刪除 blob 失敗（仍繼續清空 DB）:', e);
      }
    }

    await prisma.group.update({
      where: { id: groupId },
      data: {
        reportUrl: null,
        reportFileName: null,
        reportUploadedAt: null,
        reportUploadedById: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('刪除報告 API 錯誤:', error);
    return NextResponse.json(
      {
        error: '刪除失敗',
        details: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 }
    );
  }
}
