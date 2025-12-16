'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
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

  const deleteGroup = async (id: string, name: string) => {
    if (!confirm(`確定要刪除分組 ${name} 嗎？這將同時刪除所有相關的學生分組關係。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/groups/${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '刪除分組失敗');
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
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
        <Link
          href={`/groups/new${courseId ? `?courseId=${courseId}` : ''}`}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          新增分組
        </Link>
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
                          還有 {group.studentGroups.length - 3} 位學生...
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
    </div>
  );
}