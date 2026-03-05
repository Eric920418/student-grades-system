'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Group {
  id: string;
  name: string;
  description?: string;
  courseId: string;
  studentGroups: Array<{
    student: {
      id: string;
      name: string;
      studentId: string;
    };
    role?: string;
  }>;
}

export default function EditGroupPage({ params }: { params: { id: string } }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchGroup();
  }, []);

  const fetchGroup = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/groups/${params.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '獲取分組資料失敗');
      }

      setGroup(data);
      setName(data.name);
      setDescription(data.description || '');
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : '載入資料失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('分組名稱為必填欄位');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/groups/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新分組失敗');
      }

      router.push(`/groups${group?.courseId ? `?courseId=${group.courseId}` : ''}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : '更新分組失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">載入中...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600">{error || '找不到分組資料'}</div>
        <Link
          href="/groups"
          className="text-blue-600 hover:text-blue-800 mt-2 inline-block"
        >
          返回分組列表
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← 返回首頁
          </Link>
          <Link
            href={`/groups${group.courseId ? `?courseId=${group.courseId}` : ''}`}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← 返回分組列表
          </Link>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">編輯分組</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            分組名稱 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="輸入分組名稱"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            描述
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="輸入分組描述（選填）"
          />
        </div>

        {group.studentGroups.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              目前成員 ({group.studentGroups.length})
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {group.studentGroups.map((sg) => (
                <div key={sg.student.id} className="text-sm text-gray-700 flex justify-between items-center">
                  <span>{sg.student.studentId} - {sg.student.name}</span>
                  {sg.role && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {sg.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              如需調整成員，請前往
              <Link href={`/groups/${group.id}/manage`} className="text-blue-600 hover:text-blue-800 mx-1">
                管理學生
              </Link>
              頁面
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {saving ? '儲存中...' : '儲存變更'}
          </button>
          <Link
            href={`/groups${group.courseId ? `?courseId=${group.courseId}` : ''}`}
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  );
}
