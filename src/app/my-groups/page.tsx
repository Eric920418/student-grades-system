'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface Member {
  studentDbId: string;
  name: string;
  studentId: string;
  class: string;
  role: string | null;
  isLeader: boolean;
  studentGroupId: string;
}

interface GroupInfo {
  id: string;
  name: string;
  members: Member[];
}

interface CourseGroup {
  courseId: string;
  courseName: string;
  courseCode: string | null;
  studentDbId: string;
  hasGroup: boolean;
  group: GroupInfo | null;
  myRole: string | null;
  isLeader: boolean;
}

interface AvailableGroup {
  id: string;
  name: string;
  memberCount: number;
  leaderName: string | null;
}

interface AvailableCourse {
  id: string;
  name: string;
  code: string | null;
}

const ROLES = ['導演', '模型', '後製', '動畫', '企劃', '美術'];

export default function MyGroupsPage() {
  const { user } = useAuth();
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  // 加入分組相關
  const [joiningCourseId, setJoiningCourseId] = useState<string | null>(null);
  const [availableGroups, setAvailableGroups] = useState<AvailableGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // 角色編輯相關
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');

  const fetchMyGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/student/groups');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取得分組失敗');
      setCourseGroups(data.courseGroups);
      setAvailableCourses(data.availableCourses);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '取得分組失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'student') {
      fetchMyGroups();
    }
  }, [user, fetchMyGroups]);

  const handleAction = async (
    action: string,
    payload: Record<string, unknown>,
    loadingKey: string
  ) => {
    setActionLoading(loadingKey);
    setError('');
    try {
      const res = await fetch('/api/student/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失敗');
      await fetchMyGroups();
      setJoiningCourseId(null);
      setEditingMember(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗');
    } finally {
      setActionLoading('');
    }
  };

  const fetchAvailableGroups = async (courseId: string) => {
    setLoadingGroups(true);
    setJoiningCourseId(courseId);
    try {
      const res = await fetch(`/api/groups?courseId=${courseId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAvailableGroups(
        data.map((g: { id: string; name: string; studentGroups: { isLeader: boolean; student: { name: string } }[] }) => {
          const leader = g.studentGroups?.find((sg) => sg.isLeader);
          return {
            id: g.id,
            name: g.name,
            memberCount: g.studentGroups?.length || 0,
            leaderName: leader?.student.name || null,
          };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '取得可用分組失敗');
    } finally {
      setLoadingGroups(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">載入中...</div>;
  }

  if (!user || user.role !== 'student') {
    return (
      <div className="text-center py-8 text-red-600">
        請以學生身份登入
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">我的分組</h1>
        <span className="text-sm text-gray-500">
          {user.name}（{user.studentId}）
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* 加入課程區塊 */}
      {availableCourses.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">加入課程</h2>
          <p className="text-sm text-gray-500 mb-4">以下是你尚未加入的課程，點擊「加入」即可加入</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {availableCourses.map((course) => (
              <div
                key={course.id}
                className="flex items-center justify-between border rounded-lg px-4 py-3"
              >
                <div>
                  <span className="font-medium text-gray-800">{course.name}</span>
                  {course.code && (
                    <span className="text-sm text-gray-500 ml-2">({course.code})</span>
                  )}
                </div>
                <button
                  onClick={() =>
                    handleAction('join-course', { courseId: course.id }, `join-course-${course.id}`)
                  }
                  disabled={!!actionLoading}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors"
                >
                  {actionLoading === `join-course-${course.id}` ? '加入中...' : '加入'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {courseGroups.length === 0 && availableCourses.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
          目前沒有可用的課程
        </div>
      ) : courseGroups.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
          你尚未加入任何課程，請從上方選擇課程加入
        </div>
      ) : (
        courseGroups.map((cg) => (
          <div key={cg.courseId} className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {cg.courseName}
                {cg.courseCode && (
                  <span className="text-sm text-gray-500 ml-2">({cg.courseCode})</span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                {cg.hasGroup && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    cg.isLeader
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {cg.isLeader ? '組長' : '組員'}
                  </span>
                )}
                <button
                  onClick={() => {
                    if (confirm(`確定要退出「${cg.courseName}」嗎？${cg.hasGroup ? '這會同時離開你的分組。' : ''}退出後你的成績記錄也會被移除。`)) {
                      handleAction('leave-course', { courseId: cg.courseId }, `leave-course-${cg.courseId}`);
                    }
                  }}
                  disabled={!!actionLoading}
                  className="text-xs text-red-500 hover:text-red-700 disabled:text-gray-400"
                >
                  {actionLoading === `leave-course-${cg.courseId}` ? '處理中...' : '退出課程'}
                </button>
              </div>
            </div>

            {cg.hasGroup && cg.group ? (
              /* 已有分組 */
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-800">{cg.group.name}</h3>
                  <button
                    onClick={() =>
                      handleAction('leave', { groupId: cg.group!.id }, `leave-${cg.courseId}`)
                    }
                    disabled={actionLoading === `leave-${cg.courseId}`}
                    className="text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
                  >
                    {actionLoading === `leave-${cg.courseId}` ? '處理中...' : '離開分組'}
                  </button>
                </div>

                {/* 成員列表 */}
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 md:px-4 text-left font-medium text-gray-600">姓名</th>
                        <th className="px-3 py-2 md:px-4 text-left font-medium text-gray-600">學號</th>
                        <th className="px-3 py-2 md:px-4 text-left font-medium text-gray-600">班級</th>
                        <th className="px-3 py-2 md:px-4 text-left font-medium text-gray-600">職位</th>
                        <th className="px-3 py-2 md:px-4 text-left font-medium text-gray-600">身份</th>
                        {cg.isLeader && (
                          <th className="px-3 py-2 md:px-4 text-left font-medium text-gray-600">操作</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cg.group.members.map((member) => (
                        <tr
                          key={member.studentGroupId}
                          className={member.isLeader ? 'bg-yellow-50' : ''}
                        >
                          <td className="px-3 py-2 md:px-4">{member.name}</td>
                          <td className="px-3 py-2 md:px-4 text-gray-600">{member.studentId}</td>
                          <td className="px-3 py-2 md:px-4 text-gray-600">{member.class}班</td>
                          <td className="px-3 py-2 md:px-4">
                            {editingMember === member.studentGroupId ? (
                              <div className="flex items-center gap-1">
                                <select
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value)}
                                  className="text-sm border rounded px-1 py-0.5"
                                >
                                  <option value="">無</option>
                                  {ROLES.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() =>
                                    handleAction(
                                      'update-role',
                                      {
                                        groupId: cg.group!.id,
                                        targetStudentId: member.studentDbId,
                                        role: editRole,
                                      },
                                      `role-${member.studentGroupId}`
                                    )
                                  }
                                  disabled={actionLoading === `role-${member.studentGroupId}`}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                  確認
                                </button>
                                <button
                                  onClick={() => setEditingMember(null)}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <span className={member.role ? 'text-gray-900' : 'text-gray-400'}>
                                {member.role || '未指定'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 md:px-4">
                            {member.isLeader && (
                              <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">
                                組長
                              </span>
                            )}
                          </td>
                          {cg.isLeader && (
                            <td className="px-3 py-2 md:px-4">
                              <div className="flex flex-wrap items-center gap-2">
                                {editingMember !== member.studentGroupId && (
                                  <button
                                    onClick={() => {
                                      setEditingMember(member.studentGroupId);
                                      setEditRole(member.role || '');
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    編輯職位
                                  </button>
                                )}
                                {!member.isLeader && (
                                  <button
                                    onClick={() =>
                                      handleAction(
                                        'set-leader',
                                        {
                                          groupId: cg.group!.id,
                                          targetStudentId: member.studentDbId,
                                        },
                                        `leader-${member.studentGroupId}`
                                      )
                                    }
                                    disabled={actionLoading === `leader-${member.studentGroupId}`}
                                    className="text-xs text-yellow-600 hover:text-yellow-800 disabled:text-gray-400"
                                  >
                                    設為組長
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* 未分組 */
              <div className="space-y-3">
                <p className="text-gray-500 text-sm">你在此課程尚未加入分組</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      handleAction('create', { courseId: cg.courseId }, `create-${cg.courseId}`)
                    }
                    disabled={!!actionLoading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                  >
                    {actionLoading === `create-${cg.courseId}` ? '建立中...' : '建立新分組'}
                  </button>
                  <button
                    onClick={() => fetchAvailableGroups(cg.courseId)}
                    disabled={!!actionLoading || loadingGroups}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:text-gray-400 transition-colors"
                  >
                    加入現有分組
                  </button>
                </div>

                {/* 可加入的分組列表 */}
                {joiningCourseId === cg.courseId && (
                  <div className="mt-3 border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">選擇要加入的分組</h4>
                      <button
                        onClick={() => setJoiningCourseId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        關閉
                      </button>
                    </div>
                    {loadingGroups ? (
                      <p className="text-sm text-gray-500">載入中...</p>
                    ) : availableGroups.length === 0 ? (
                      <p className="text-sm text-gray-500">目前沒有可加入的分組</p>
                    ) : (
                      <div className="space-y-2">
                        {availableGroups.map((g) => (
                          <div
                            key={g.id}
                            className="flex items-center justify-between bg-white px-3 py-2 rounded border"
                          >
                            <span className="text-sm">
                              {g.name}
                              {g.leaderName && (
                                <span className="text-gray-700 ml-1.5">- {g.leaderName}</span>
                              )}
                              <span className="text-gray-500 ml-2">({g.memberCount} 人)</span>
                            </span>
                            <button
                              onClick={() =>
                                handleAction('join', { groupId: g.id }, `join-${g.id}`)
                              }
                              disabled={!!actionLoading}
                              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                            >
                              {actionLoading === `join-${g.id}` ? '加入中...' : '加入'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
