'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function NewGradeItemPage() {
  const [formData, setFormData] = useState({
    name: '',
    weight: '1',
    maxScore: '100'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('項目名稱為必填欄位');
      return;
    }

    if (!courseId) {
      setError('缺少課程 ID，請從課程頁面進入');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/grade-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          weight: parseFloat(formData.weight) / 100,
          maxScore: parseFloat(formData.maxScore),
          courseId: courseId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 完整顯示所有錯誤信息
        const errorDetails = data.details ? `\n詳細信息: ${data.details}` : '';
        const errorStack = data.stack ? `\n堆疊追蹤:\n${data.stack}` : '';
        throw new Error(`${data.error || '新增項目失敗'}${errorDetails}${errorStack}`);
      }

      router.push(`/grade-items${courseId ? `?courseId=${courseId}` : ''}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '新增項目失敗';
      setError(errorMessage);
      console.error('新增項目錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

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
            href={`/grade-items${courseId ? `?courseId=${courseId}` : ''}`}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← 返回項目列表
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">新增成績項目</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <pre className="whitespace-pre-wrap text-sm font-mono">{error}</pre>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              項目名稱 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例如：期中考、期末考、作業"
            />
          </div>

          <div>
            <label htmlFor="maxScore" className="block text-sm font-medium text-gray-700 mb-1">
              滿分
            </label>
            <input
              type="number"
              id="maxScore"
              name="maxScore"
              value={formData.maxScore}
              onChange={handleChange}
              min="1"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="100"
            />
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? '處理中...' : '新增項目'}
            </button>
            <Link
              href={`/grade-items${courseId ? `?courseId=${courseId}` : ''}`}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
            >
              取消
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}