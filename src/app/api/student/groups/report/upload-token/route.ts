import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getUserFromHeaders } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_PDF_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = getUserFromHeaders(request);
    if (!user || user.role !== 'student' || !user.studentId) {
      return NextResponse.json({ error: '請先登入學生帳號' }, { status: 401 });
    }
    const studentIdFromHeader = user.studentId;

    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!clientPayload) {
          throw new Error('缺少 clientPayload，必須傳入 groupId');
        }
        let parsed: { groupId?: string };
        try {
          parsed = JSON.parse(clientPayload) as { groupId?: string };
        } catch {
          throw new Error('clientPayload 格式錯誤（需為 JSON）');
        }
        const { groupId } = parsed;
        if (!groupId) {
          throw new Error('clientPayload 缺少 groupId');
        }

        const expectedPrefix = `reports/${groupId}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error(`pathname 必須以 ${expectedPrefix} 開頭`);
        }

        const group = await prisma.group.findUnique({
          where: { id: groupId },
          select: { id: true, courseId: true },
        });
        if (!group) {
          throw new Error('找不到指定的組別');
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
          throw new Error('只有組長可以上傳報告');
        }

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: MAX_PDF_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ groupId }),
        };
      },
      onUploadCompleted: async () => {
        // 本地 dev 時 webhook 不會到達 localhost，所以 DB 寫入改由前端在 upload() 完成後
        // 主動呼叫 POST /api/student/groups/report 執行，這裡只保留 callback 簽名讓 SDK 滿足
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('報告上傳 token API 錯誤:', error);
    return NextResponse.json(
      {
        error: '上傳授權失敗',
        details: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 400 }
    );
  }
}
