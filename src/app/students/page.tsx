'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Student {
  id: string;
  name: string;
  studentId: string;
  email?: string;
  class: string;
  createdAt: string;
  course?: {
    name: string;
    code?: string;
  };
  studentGroups: Array<{
    group: {
      name: string;
    };
    role?: string;
  }>;
  grades: Array<{
    score: number;
    gradeItem: {
      name: string;
    }
  }>;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [courseName, setCourseName] = useState<string>('');
  
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  useEffect(() => {
    fetchStudents();
  }, [classFilter, courseId]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // 建構查詢參數
      const params = new URLSearchParams();
      if (classFilter !== 'all') params.append('class', classFilter);
      if (courseId) params.append('courseId', courseId);
      
      const url = `/api/students${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '獲取學生列表失敗');
      }
      
      setStudents(data);
      
      // 設定課程名稱
      if (data.length > 0 && data[0].course) {
        setCourseName(data[0].course.name);
      }
      
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : '獲取學生列表失敗');
      console.error('獲取學生列表錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteStudent = async (id: string, name: string) => {
    if (!confirm(`確定要刪除學生 ${name} 嗎？這將同時刪除相關的分組和成績記錄。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/students/${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '刪除學生失敗');
      }
      
      await fetchStudents();
    } catch (error) {
      setError(error instanceof Error ? error.message : '刪除學生失敗');
      console.error('刪除學生錯誤:', error);
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
            學生管理
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="class-filter" className="text-sm font-medium text-gray-700">
              班級篩選：
            </label>
            <select
              id="class-filter"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部班級</option>
              <option value="A">A班</option>
              <option value="B">B班</option>
            </select>
          </div>
          <Link
            href={`/students/new${courseId ? `?courseId=${courseId}` : ''}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            新增學生
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {students.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            尚無學生資料，請先新增學生
          </div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  學號
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  姓名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  班級
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  分組
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  成績數量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.studentId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {student.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      student.class === 'A' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {student.class}班
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {student.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {student.studentGroups.length > 0 
                      ? (
                          <div className="space-y-1">
                            {student.studentGroups.map((sg, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <span>{sg.group.name}</span>
                                {sg.role && (
                                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                                    {sg.role}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      : '未分組'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {student.grades.length} 項
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <Link
                      href={`/students/${student.id}/edit`}
                      className="text-blue-600 hover:text-blue-900 transition-colors"
                    >
                      編輯
                    </Link>
                    <button
                      onClick={() => deleteStudent(student.id, student.name)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}