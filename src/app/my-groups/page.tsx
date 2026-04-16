'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { useAuth } from '@/components/AuthProvider';
import PdfFullscreenViewer from '@/components/PdfFullscreenViewer';

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
  reportUrl: string | null;
  reportFileName: string | null;
  reportUploadedAt: string | null;
  reportUploadedById: string | null;
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
  allowStudentGrouping: boolean;
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

  // 期中報告相關
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string>('');
  const [uploadingGroupId, setUploadingGroupId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const handleUploadReport = async (groupId: string, file: File) => {
    setError('');
    if (file.type !== 'application/pdf') {
      setError(`檔案類型必須為 PDF（目前：${file.type || '未知'}）`);
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError(`檔案超過 100MB 上限（目前：${(file.size / 1024 / 1024).toFixed(1)}MB）`);
      return;
    }
    setUploadingGroupId(groupId);
    try {
      const blob = await upload(`reports/${groupId}/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/student/groups/report/upload-token',
        clientPayload: JSON.stringify({ groupId }),
        contentType: 'application/pdf',
      });

      const completeRes = await fetch('/api/student/groups/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          blobUrl: blob.url,
          fileName: file.name,
        }),
      });
      const completeText = await completeRes.text();
      let completeJson: { error?: string; details?: string } = {};
      try {
        completeJson = completeText ? JSON.parse(completeText) : {};
      } catch {
        throw new Error(`完成上傳失敗（回應非 JSON）：${completeText.slice(0, 200)}`);
      }
      if (!completeRes.ok) {
        throw new Error(
          completeJson.error || completeJson.details || `完成上傳失敗（HTTP ${completeRes.status}）`
        );
      }

      await fetchMyGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗');
    } finally {
      setUploadingGroupId(null);
      const ref = fileInputRefs.current[groupId];
      if (ref) ref.value = '';
    }
  };

  const handleDeleteReport = async (groupId: string) => {
    if (!confirm('確定要刪除此組的期中報告 PDF 嗎？此動作無法復原。')) return;
    setActionLoading(`delete-report-${groupId}`);
    setError('');
    try {
      const res = await fetch('/api/student/groups/report', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      });
      const text = await res.text();
      let data: { error?: string; details?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`刪除失敗（回應非 JSON）：${text.slice(0, 200)}`);
      }
      if (!res.ok) {
        throw new Error(data.error || data.details || `刪除失敗（HTTP ${res.status}）`);
      }
      await fetchMyGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗');
    } finally {
      setActionLoading('');
    }
  };

  const openReportViewer = (
    url: string,
    fileName: string | null,
    title: string
  ) => {
    setViewerUrl(url);
    setViewerFileName(fileName);
    setViewerTitle(title);
    setViewerOpen(true);
  };

  const closeReportViewer = () => {
    setViewerOpen(false);
    setViewerUrl(null);
    setViewerFileName(null);
    setViewerTitle('');
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
                {cg.allowStudentGrouping !== false && (
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
                )}
              </div>
            </div>

            {cg.hasGroup && cg.group ? (
              /* 已有分組 */
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-800">
                    {cg.group.name}
                    <span className="text-sm text-gray-500 ml-2">({cg.group.members.length}/5 人)</span>
                  </h3>
                  {cg.allowStudentGrouping !== false && (
                    <button
                      onClick={() =>
                        handleAction('leave', { groupId: cg.group!.id }, `leave-${cg.courseId}`)
                      }
                      disabled={actionLoading === `leave-${cg.courseId}`}
                      className="text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
                    >
                      {actionLoading === `leave-${cg.courseId}` ? '處理中...' : '離開分組'}
                    </button>
                  )}
                </div>

                {/* 期中報告 PDF */}
                <div className="mb-4 border rounded-lg p-4 bg-gray-50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                        📄 期中報告 PDF
                      </h4>
                      {cg.group.reportUrl ? (
                        <div className="mt-1 text-xs text-gray-600">
                          <div className="truncate">
                            檔名：<span className="font-medium text-gray-800">{cg.group.reportFileName || '未命名.pdf'}</span>
                          </div>
                          {cg.group.reportUploadedAt && (
                            <div>
                              上傳於：{new Date(cg.group.reportUploadedAt).toLocaleString('zh-TW')}
                              {cg.group.reportUploadedById && (
                                <span className="ml-1 text-gray-500">（{cg.group.reportUploadedById}）</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500">
                          {cg.isLeader
                            ? '尚未上傳，請上傳期中報告 PDF（最大 100MB）'
                            : '組長尚未上傳報告'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {cg.group.reportUrl && (
                        <button
                          onClick={() =>
                            openReportViewer(
                              cg.group!.reportUrl!,
                              cg.group!.reportFileName,
                              `${cg.courseName} - ${cg.group!.name} 期中報告`
                            )
                          }
                          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm"
                        >
                          📖 瀏覽（全螢幕）
                        </button>
                      )}
                      {cg.isLeader && (
                        <>
                          <input
                            ref={(el) => {
                              fileInputRefs.current[cg.group!.id] = el;
                            }}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadReport(cg.group!.id, file);
                            }}
                          />
                          <button
                            onClick={() => fileInputRefs.current[cg.group!.id]?.click()}
                            disabled={uploadingGroupId === cg.group!.id}
                            className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:bg-green-400 text-sm"
                          >
                            {uploadingGroupId === cg.group!.id
                              ? '上傳中...'
                              : cg.group!.reportUrl
                                ? '🔄 重新上傳'
                                : '⬆️ 上傳 PDF'}
                          </button>
                          {cg.group!.reportUrl && (
                            <button
                              onClick={() => handleDeleteReport(cg.group!.id)}
                              disabled={actionLoading === `delete-report-${cg.group!.id}`}
                              className="bg-white border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:text-gray-400 text-sm"
                            >
                              {actionLoading === `delete-report-${cg.group!.id}` ? '刪除中...' : '🗑 刪除'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
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
                {cg.allowStudentGrouping === false ? (
                  <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-lg text-sm">
                    老師已關閉此課程的自助分組功能
                  </div>
                ) : (
                <>
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
                              <span className="text-gray-500 ml-2">({g.memberCount}/5 人)</span>
                            </span>
                            <button
                              onClick={() =>
                                handleAction('join', { groupId: g.id }, `join-${g.id}`)
                              }
                              disabled={!!actionLoading || g.memberCount >= 5}
                              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                            >
                              {g.memberCount >= 5 ? '已滿' : actionLoading === `join-${g.id}` ? '加入中...' : '加入'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                </>
                )}
              </div>
            )}
          </div>
        ))
      )}

      <PdfFullscreenViewer
        open={viewerOpen}
        url={viewerUrl}
        fileName={viewerFileName}
        title={viewerTitle}
        onClose={closeReportViewer}
      />
    </div>
  );
}
