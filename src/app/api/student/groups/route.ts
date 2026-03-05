import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromHeaders } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromHeaders(request);
    if (!user || user.role !== 'student' || !user.studentId) {
      return NextResponse.json({ error: '請先登入學生帳號' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentIdParam = searchParams.get('studentId');

    // 只能查自己的資料
    const targetStudentId = studentIdParam || user.studentId;
    if (targetStudentId !== user.studentId) {
      return NextResponse.json({ error: '只能查詢自己的分組' }, { status: 403 });
    }

    // 取得該學號在所有課程的學生記錄
    const students = await prisma.student.findMany({
      where: { studentId: targetStudentId },
      include: {
        course: true,
        studentGroups: {
          include: {
            group: {
              include: {
                studentGroups: {
                  include: {
                    student: {
                      select: { id: true, name: true, studentId: true, class: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // 整理回傳格式：按課程分組
    const courseGroups = students.map(student => {
      const group = student.studentGroups[0]?.group || null;
      return {
        courseId: student.courseId,
        courseName: student.course.name,
        courseCode: student.course.code,
        studentDbId: student.id,
        hasGroup: !!group,
        group: group ? {
          id: group.id,
          name: group.name,
          members: group.studentGroups.map(sg => ({
            studentDbId: sg.student.id,
            name: sg.student.name,
            studentId: sg.student.studentId,
            class: sg.student.class,
            role: sg.role,
            isLeader: sg.isLeader,
            studentGroupId: sg.id,
          })),
        } : null,
        myRole: student.studentGroups[0]?.role || null,
        isLeader: student.studentGroups[0]?.isLeader || false,
      };
    });

    // 取得該學號已加入的課程 ID
    const joinedCourseIds = students.map(s => s.courseId);

    // 取得尚未加入的課程列表
    const availableCourses = await prisma.course.findMany({
      where: joinedCourseIds.length > 0
        ? { id: { notIn: joinedCourseIds } }
        : {},
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ courseGroups, availableCourses });
  } catch (error) {
    console.error('取得學生分組資訊錯誤:', error);
    return NextResponse.json(
      { error: '取得分組資訊失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromHeaders(request);
    if (!user || user.role !== 'student' || !user.studentId) {
      return NextResponse.json({ error: '請先登入學生帳號' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create':
        return handleCreate(body, user.studentId);
      case 'join':
        return handleJoin(body, user.studentId);
      case 'join-course':
        return handleJoinCourse(body, user.studentId);
      case 'leave':
        return handleLeave(body, user.studentId);
      case 'leave-course':
        return handleLeaveCourse(body, user.studentId);
      case 'update-role':
        return handleUpdateRole(body, user.studentId);
      case 'set-leader':
        return handleSetLeader(body, user.studentId);
      default:
        return NextResponse.json({ error: '無效的操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('學生分組操作錯誤:', error);
    return NextResponse.json(
      { error: '操作失敗', details: error instanceof Error ? error.message : '未知錯誤' },
      { status: 500 }
    );
  }
}

// 加入課程（建立 Student 記錄）
async function handleJoinCourse(body: { courseId?: string }, loginStudentId: string) {
  const { courseId } = body;
  if (!courseId) {
    return NextResponse.json({ error: '請指定課程' }, { status: 400 });
  }

  // 確認課程存在
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: '課程不存在' }, { status: 404 });
  }

  // 檢查是否已經在此課程中
  const existing = await prisma.student.findFirst({
    where: { studentId: loginStudentId, courseId },
  });
  if (existing) {
    return NextResponse.json({ error: '你已經在此課程中' }, { status: 400 });
  }

  // 從 Account 讀取 name/class
  const account = await prisma.account.findUnique({
    where: { studentId: loginStudentId },
  });
  if (!account) {
    return NextResponse.json({ error: '帳號不存在，請重新登入' }, { status: 400 });
  }

  // 建立 Student 記錄
  await prisma.student.create({
    data: {
      studentId: loginStudentId,
      name: account.name,
      class: account.class,
      courseId,
    },
  });

  return NextResponse.json({ success: true, message: `已加入「${course.name}」` });
}

// 建立新分組（自動成為組長）
async function handleCreate(body: { courseId?: string }, loginStudentId: string) {
  const { courseId } = body;
  if (!courseId) {
    return NextResponse.json({ error: '請指定課程' }, { status: 400 });
  }

  // 找到此學號在此課程的學生記錄
  const student = await prisma.student.findFirst({
    where: { studentId: loginStudentId, courseId },
  });
  if (!student) {
    return NextResponse.json({ error: '你不在此課程中' }, { status: 400 });
  }

  // 檢查是否已有分組
  const existing = await prisma.studentGroup.findFirst({
    where: { studentId: student.id, group: { courseId } },
  });
  if (existing) {
    return NextResponse.json({ error: '你在此課程已有分組，請先離開現有分組' }, { status: 400 });
  }

  // 自動生成分組名稱
  const existingGroups = await prisma.group.findMany({
    where: { courseId },
    select: { name: true },
  });
  const existingNumbers = existingGroups
    .map(g => g.name.match(/第(\d+)組/))
    .filter(Boolean)
    .map(match => parseInt(match![1]))
    .sort((a, b) => a - b);

  let nextNumber = 1;
  for (const num of existingNumbers) {
    if (num === nextNumber) nextNumber++;
    else break;
  }

  const group = await prisma.group.create({
    data: {
      name: `第${nextNumber}組`,
      courseId,
      studentGroups: {
        create: {
          studentId: student.id,
          isLeader: true,
        },
      },
    },
    include: {
      studentGroups: { include: { student: true } },
    },
  });

  return NextResponse.json({ success: true, group }, { status: 201 });
}

// 加入現有分組
async function handleJoin(body: { groupId?: string }, loginStudentId: string) {
  const { groupId } = body;
  if (!groupId) {
    return NextResponse.json({ error: '請指定分組' }, { status: 400 });
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, courseId: true },
  });
  if (!group) {
    return NextResponse.json({ error: '分組不存在' }, { status: 404 });
  }

  const student = await prisma.student.findFirst({
    where: { studentId: loginStudentId, courseId: group.courseId },
  });
  if (!student) {
    return NextResponse.json({ error: '你不在此課程中' }, { status: 400 });
  }

  // 檢查同課程是否已有分組
  const existing = await prisma.studentGroup.findFirst({
    where: { studentId: student.id, group: { courseId: group.courseId } },
  });
  if (existing) {
    return NextResponse.json({ error: '你在此課程已有分組，請先離開現有分組' }, { status: 400 });
  }

  await prisma.studentGroup.create({
    data: { studentId: student.id, groupId, isLeader: false },
  });

  return NextResponse.json({ success: true });
}

// 離開分組
async function handleLeave(body: { groupId?: string }, loginStudentId: string) {
  const { groupId } = body;
  if (!groupId) {
    return NextResponse.json({ error: '請指定分組' }, { status: 400 });
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, courseId: true },
  });
  if (!group) {
    return NextResponse.json({ error: '分組不存在' }, { status: 404 });
  }

  const student = await prisma.student.findFirst({
    where: { studentId: loginStudentId, courseId: group.courseId },
  });
  if (!student) {
    return NextResponse.json({ error: '你不在此課程中' }, { status: 400 });
  }

  const membership = await prisma.studentGroup.findFirst({
    where: { studentId: student.id, groupId },
  });
  if (!membership) {
    return NextResponse.json({ error: '你不在此分組中' }, { status: 400 });
  }

  const wasLeader = membership.isLeader;

  if (wasLeader) {
    // 先查詢是否有其他成員
    const remaining = await prisma.studentGroup.findFirst({
      where: { groupId, id: { not: membership.id } },
      orderBy: { createdAt: 'asc' },
    });

    if (remaining) {
      // 有其他成員：刪除自己 + 指派新組長（原子操作）
      await prisma.$transaction([
        prisma.studentGroup.delete({ where: { id: membership.id } }),
        prisma.studentGroup.update({
          where: { id: remaining.id },
          data: { isLeader: true },
        }),
      ]);
    } else {
      // 沒有其他成員：刪除自己 + 刪除分組（原子操作）
      await prisma.$transaction([
        prisma.studentGroup.delete({ where: { id: membership.id } }),
        prisma.group.delete({ where: { id: groupId } }),
      ]);
    }
  } else {
    await prisma.studentGroup.delete({ where: { id: membership.id } });
  }

  return NextResponse.json({ success: true });
}

// 退出課程（刪除該課程的 Student 記錄，連帶移除分組和成績）
async function handleLeaveCourse(body: { courseId?: string }, loginStudentId: string) {
  const { courseId } = body;
  if (!courseId) {
    return NextResponse.json({ error: '請指定課程' }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { studentId: loginStudentId, courseId },
  });
  if (!student) {
    return NextResponse.json({ error: '你不在此課程中' }, { status: 400 });
  }

  // 檢查是否在分組中，且是組長
  const membership = await prisma.studentGroup.findFirst({
    where: { studentId: student.id, group: { courseId } },
    include: { group: true },
  });

  if (membership?.isLeader) {
    // 組長退出課程：先處理組長轉移
    const remaining = await prisma.studentGroup.findFirst({
      where: { groupId: membership.groupId, id: { not: membership.id } },
      orderBy: { createdAt: 'asc' },
    });

    if (remaining) {
      // 有其他成員：指派新組長，再刪除 Student（cascade 刪除 StudentGroup、Grade）
      await prisma.$transaction([
        prisma.studentGroup.update({
          where: { id: remaining.id },
          data: { isLeader: true },
        }),
        prisma.student.delete({ where: { id: student.id } }),
      ]);
    } else {
      // 沒有其他成員：刪除分組 + Student
      await prisma.$transaction([
        prisma.studentGroup.delete({ where: { id: membership.id } }),
        prisma.group.delete({ where: { id: membership.groupId } }),
        prisma.student.delete({ where: { id: student.id } }),
      ]);
    }
  } else {
    // 非組長或沒有分組：直接刪除 Student（cascade 處理其餘）
    await prisma.student.delete({ where: { id: student.id } });
  }

  return NextResponse.json({ success: true, message: '已退出課程' });
}

// 更新成員職位（需為同組組長）
async function handleUpdateRole(
  body: { groupId?: string; targetStudentId?: string; role?: string },
  loginStudentId: string
) {
  const { groupId, targetStudentId, role } = body;
  if (!groupId || !targetStudentId) {
    return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, courseId: true },
  });
  if (!group) {
    return NextResponse.json({ error: '分組不存在' }, { status: 404 });
  }

  // 確認操作者是組長
  const myStudent = await prisma.student.findFirst({
    where: { studentId: loginStudentId, courseId: group.courseId },
  });
  if (!myStudent) {
    return NextResponse.json({ error: '你不在此課程中' }, { status: 400 });
  }

  const myMembership = await prisma.studentGroup.findFirst({
    where: { studentId: myStudent.id, groupId },
  });
  if (!myMembership || !myMembership.isLeader) {
    return NextResponse.json({ error: '只有組長可以更新成員職位' }, { status: 403 });
  }

  // 更新目標成員的職位
  const targetMembership = await prisma.studentGroup.findFirst({
    where: { studentId: targetStudentId, groupId },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: '目標成員不在此分組中' }, { status: 400 });
  }

  await prisma.studentGroup.update({
    where: { id: targetMembership.id },
    data: { role: role || null },
  });

  return NextResponse.json({ success: true });
}

// 轉移組長（需為當前組長）
async function handleSetLeader(
  body: { groupId?: string; targetStudentId?: string },
  loginStudentId: string
) {
  const { groupId, targetStudentId } = body;
  if (!groupId || !targetStudentId) {
    return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, courseId: true },
  });
  if (!group) {
    return NextResponse.json({ error: '分組不存在' }, { status: 404 });
  }

  const myStudent = await prisma.student.findFirst({
    where: { studentId: loginStudentId, courseId: group.courseId },
  });
  if (!myStudent) {
    return NextResponse.json({ error: '你不在此課程中' }, { status: 400 });
  }

  const myMembership = await prisma.studentGroup.findFirst({
    where: { studentId: myStudent.id, groupId },
  });
  if (!myMembership || !myMembership.isLeader) {
    return NextResponse.json({ error: '只有組長可以轉移組長' }, { status: 403 });
  }

  const targetMembership = await prisma.studentGroup.findFirst({
    where: { studentId: targetStudentId, groupId },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: '目標成員不在此分組中' }, { status: 400 });
  }

  // 事務：取消自己的組長，設定目標為組長
  await prisma.$transaction([
    prisma.studentGroup.update({
      where: { id: myMembership.id },
      data: { isLeader: false },
    }),
    prisma.studentGroup.update({
      where: { id: targetMembership.id },
      data: { isLeader: true },
    }),
  ]);

  return NextResponse.json({ success: true });
}
