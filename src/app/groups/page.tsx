'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PresentationDrawModal from '@/components/PresentationDrawModal';
import PdfFullscreenViewer from '@/components/PdfFullscreenViewer';

interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  reportUrl?: string | null;
  reportFileName?: string | null;
  reportUploadedAt?: string | null;
  reportUploadedById?: string | null;
  course?: {
    name: string;
    code?: string;
  };
  studentGroups: Array<{
    student: {
      id: string;
      name: string;
      studentId: string;
    };
    role?: string;
  }>;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [showDrawModal, setShowDrawModal] = useState(false);

  // PDF 全螢幕展示
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerFileName, setViewerFileName] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('');
  const [deletingReportGroupId, setDeletingReportGroupId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  useEffect(() => {
    fetchGroups();
  }, [courseId]);

  const fetchGroups = async () => {
    try {
      setLoading(true);

      // 建構查詢參數
      const params = new URLSearchParams();
      if (courseId) params.append('courseId', courseId);

      const url = `/api/groups${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '獲取分組列表失敗');
      }

      setGroups(data);

      // 設定課程名稱
      if (data.length > 0 && data[0].course) {
        setCourseName(data[0].course.name);
      }

      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : '獲取分組列表失敗');
      console.error('獲取分組列表錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  const presentReport = (group: Group) => {
    if (!group.reportUrl) return;
    setViewerUrl(group.reportUrl);
    setViewerFileName(group.reportFileName || null);
    setViewerTitle(`${group.course?.name ? group.course.name + ' - ' : ''}${group.name} 期中報告`);
    setViewerOpen(true);
  };

  const closeReportViewer = () => {
    setViewerOpen(false);
    setViewerUrl(null);
    setViewerFileName(null);
    setViewerTitle('');
  };

  const deleteReport = async (groupId: string, groupName: string) => {
    if (!confirm(`確定要刪除 ${groupName} 的期中報告 PDF 嗎？此動作無法復原。`)) return;
    setDeletingReportGroupId(groupId);
    try {
      const response = await fetch(`/api/groups/${groupId}/report`, {
        method: 'DELETE',
      });
      const text = await response.text();
      let data: { error?: string; details?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`刪除失敗（回應非 JSON）：${text.slice(0, 200)}`);
      }
      if (!response.ok) {
        throw new Error(data.error || data.details || `刪除失敗（HTTP ${response.status}）`);
      }
      await fetchGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除報告失敗');
    } finally {
      setDeletingReportGroupId(null);
    }
  };

  const deleteGroup = async (id: string, name: string) => {
    if (!confirm(`確定要刪除分組 ${name} 嗎？這將同時刪除所有相關的學生分組關係。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/groups/${id}`, {
        method: 'DELETE',
      });

      const text = await response.text();
      let data: { error?: string; details?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`刪除失敗（回應非 JSON）：${text.slice(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || data.details || `刪除分組失敗（HTTP ${response.status}）`);
      }

      await fetchGroups();
    } catch (error) {
      setError(error instanceof Error ? error.message : '刪除分組失敗');
      console.error('刪除分組錯誤:', error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">載入中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            分組管理
            {courseName && <span className="text-lg text-gray-600 ml-2">- {courseName}</span>}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← 返回首頁
            </Link>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowDrawModal(true)}
            disabled={groups.length === 0}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            🎲 抽籤
          </button>
          <Link
            href={`/groups/new${courseId ? `?courseId=${courseId}` : ''}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            新增分組
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            尚無分組資料，請先新增分組
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="bg-white rounded-lg shadow-sm border p-3 ">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                <div className="flex space-x-1 ">
                  <Link
                    href={`/groups/${group.id}/edit`}
                    className="text-blue-600 hover:text-blue-900 text-sm"
                  >
                    編輯
                  </Link>
                  <button
                    onClick={() => deleteGroup(group.id, group.name)}
                    className="text-red-600 hover:text-red-900 text-sm"
                  >
                    刪除
                  </button>
                </div>
              </div>

              {group.description && (
                <p className="text-gray-600 text-sm mb-4">{group.description}</p>
              )}

              {/* 期中報告 */}
              <div className="mb-3 border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-800">📄 期中報告</span>
                  {group.reportUrl ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">已上傳</span>
                  ) : (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">尚未上傳</span>
                  )}
                </div>
                {group.reportUrl ? (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600 truncate" title={group.reportFileName || ''}>
                      {group.reportFileName || '未命名.pdf'}
                    </div>
                    {group.reportUploadedAt && (
                      <div className="text-xs text-gray-500">
                        上傳於 {new Date(group.reportUploadedAt).toLocaleString('zh-TW')}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => presentReport(group)}
                        className="bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 text-sm"
                        title="開啟報告後再按「全螢幕」按鈕進入全螢幕"
                      >
                        📺 開啟報告
                      </button>
                      <button
                        onClick={() => deleteReport(group.id, group.name)}
                        disabled={deletingReportGroupId === group.id}
                        className="bg-white border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:text-gray-400 text-sm"
                      >
                        {deletingReportGroupId === group.id ? '刪除中...' : '🗑 刪除'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">組長尚未上傳 PDF</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    學生人數: {group.studentGroups.length}
                  </span>
                  <Link
                    href={`/groups/${group.id}/manage`}
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                  >
                    管理學生
                  </Link>
                </div>

                {group.studentGroups.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-gray-500 mb-2">分組學生:</p>
                    <div className="space-y-1">
                      {group.studentGroups.slice(0, 6).map((sg) => (
                        <div key={sg.student.id} className="text-sm text-gray-700 flex justify-between items-center">
                          <span>{sg.student.studentId} - {sg.student.name}</span>
                          {sg.role && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              {sg.role}
                            </span>
                          )}
                        </div>
                      ))}
                      {group.studentGroups.length > 6 && (
                        <div className="text-xs text-gray-500">
                          還有 {group.studentGroups.length - 6} 位學生...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <PresentationDrawModal
        open={showDrawModal}
        onClose={() => setShowDrawModal(false)}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      />

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
