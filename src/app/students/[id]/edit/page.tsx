'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Student {
  id: string;
  name: string;
  studentId: string;
  email?: string;
  class: string;
}

export default function EditStudentPage({ params }: { params: { id: string } }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    studentId: '',
    email: '',
    class: 'A'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchStudent();
  }, []);

  const fetchStudent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/students/${params.id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '獲取學生資料失敗');
      }
      
      setStudent(data);
      setFormData({
        name: data.name,
        studentId: data.studentId,
        email: data.email || '',
        class: data.class || 'A'
      });
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : '獲取學生資料失敗');
      console.error('獲取學生資料錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.studentId.trim()) {
      setError('姓名和學號為必填欄位');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/students/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          studentId: formData.studentId.trim(),
          email: formData.email.trim() || null,
          class: formData.class
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '更新學生失敗');
      }

      router.push('/students');
    } catch (error) {
      setError(error instanceof Error ? error.message : '更新學生失敗');
      console.error('更新學生錯誤:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">載入中...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600">找不到學生資料</div>
        <Link
          href="/students"
          className="text-blue-600 hover:text-blue-800 mt-2 inline-block"
        >
          返回學生列表
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
            href="/students"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← 返回學生列表
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">編輯學生</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="請輸入學生姓名"
            />
          </div>

          <div>
            <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-1">
              學號 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="studentId"
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="請輸入學號"
            />
          </div>

          <div>
            <label htmlFor="class" className="block text-sm font-medium text-gray-700 mb-1">
              班級 <span className="text-red-500">*</span>
            </label>
            <select
              id="class"
              name="class"
              value={formData.class}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="A">A班</option>
              <option value="B">B班</option>
            </select>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email（選填）
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="請輸入Email地址"
            />
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {saving ? '處理中...' : '更新學生'}
            </button>
            <Link
              href="/students"
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