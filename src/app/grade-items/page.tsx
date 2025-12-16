'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface GradeItem {
  id: string;
  name: string;
  weight: number;
  maxScore: number;
  createdAt: string;
  course?: {
    name: string;
    code?: string;
  };
  grades: Array<{
    score: number;
    student: {
      name: string;
      studentId: string;
    }
  }>;
}

export default function GradeItemsPage() {
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  useEffect(() => {
    fetchGradeItems();
  }, [courseId]);

  const fetchGradeItems = async () => {
    try {
      setLoading(true);

      // 建構查詢參數
      const params = new URLSearchParams();
      if (courseId) params.append('courseId', courseId);

      const url = `/api/grade-items${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '獲取成績項目失敗');
      }

      setGradeItems(data);

      // 設定課程名稱
      if (data.length > 0 && data[0].course) {
        setCourseName(data[0].course.name);
      }

      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : '獲取成績項目失敗');
      console.error('獲取成績項目錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    try {
      setDeleting(id);
      setError(null);

      const response = await fetch(`/api/grade-items/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || '刪除成績項目失敗');
      }

      // 刪除成功，重新獲取列表
      await fetchGradeItems();
      setDeleteConfirm(null);

      // 顯示成功訊息（可選）
      alert(`✅ ${data.message}\n${data.deletedGradesCount > 0 ? `已同時刪除 ${data.deletedGradesCount} 筆成績記錄` : ''}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '刪除成績項目失敗';
      setError(errorMessage);
      console.error('刪除成績項目錯誤:', error);
    } finally {
      setDeleting(null);
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
            成績項目管理
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
          href={`/grade-items/new${courseId ? `?courseId=${courseId}` : ''}`}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          新增項目
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {gradeItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            尚無成績項目，請先新增項目
          </div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  項目名稱
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  權重
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  滿分
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  已登記成績數
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  平均分數
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {gradeItems.map((item) => {
                const avgScore = item.grades.length > 0
                  ? item.grades.reduce((sum, grade) => sum + grade.score, 0) / item.grades.length
                  : 0;

                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(item.weight * 100).toFixed(0)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.maxScore}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.grades.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {avgScore.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/grade-items/${item.id}${courseId ? `?courseId=${courseId}` : ''}`}
                          className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                        >
                          查看詳情
                        </Link>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          disabled={deleting === item.id}
                          className={`px-3 py-1 rounded transition-colors ${
                            deleteConfirm === item.id
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'text-red-600 hover:text-red-900 hover:bg-red-50'
                          } ${deleting === item.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {deleting === item.id ? '刪除中...' : deleteConfirm === item.id ? '確認刪除？' : '刪除'}
                        </button>
                        {deleteConfirm === item.id && (
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-gray-600 hover:text-gray-900 px-3 py-1 rounded hover:bg-gray-100 transition-colors"
                          >
                            取消
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}