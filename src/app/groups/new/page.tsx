'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Student {
  id: string;
  name: string;
  studentId: string;
  class: string;
  studentGroups: Array<{
    group: {
      id: string;
      name: string;
    };
  }>;
}

interface SelectedStudent {
  id: string;
  name: string;
  studentId: string;
  role: string;
  isLeader: boolean;
}

const AVAILABLE_ROLES = ['導演', '模型', '後製', '動畫', '企劃', '美術'];

export default function NewGroupPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<SelectedStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  useEffect(() => {
    fetchStudents();
  }, [courseId]);

  const fetchStudents = async () => {
    try {
      setLoadingStudents(true);
      const params = new URLSearchParams();
      if (courseId) params.append('courseId', courseId);
      
      const response = await fetch(`/api/students?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '獲取學生列表失敗');
      }
      
      setStudents(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : '獲取學生列表失敗');
    } finally {
      setLoadingStudents(false);
    }
  };

  const addStudent = (student: Student) => {
    if (selectedStudents.find(s => s.id === student.id)) {
      return;
    }
    
    const newStudent: SelectedStudent = {
      id: student.id,
      name: student.name,
      studentId: student.studentId,
      role: AVAILABLE_ROLES[0],
      isLeader: selectedStudents.length === 0 // 第一個學生預設為組長
    };
    
    setSelectedStudents([...selectedStudents, newStudent]);
  };

  const removeStudent = (studentId: string) => {
    const updatedStudents = selectedStudents.filter(s => s.id !== studentId);
    
    // 如果移除的是組長且還有其他成員，將第一個成員設為組長
    if (selectedStudents.find(s => s.id === studentId)?.isLeader && updatedStudents.length > 0) {
      updatedStudents[0].isLeader = true;
    }
    
    setSelectedStudents(updatedStudents);
  };

  const updateStudentRole = (studentId: string, role: string) => {
    setSelectedStudents(selectedStudents.map(s => 
      s.id === studentId ? { ...s, role } : s
    ));
  };

  const setLeader = (studentId: string) => {
    setSelectedStudents(selectedStudents.map(s => ({
      ...s,
      isLeader: s.id === studentId
    })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedStudents.length === 0) {
      setError('請至少選擇一位學生');
      return;
    }

    const leader = selectedStudents.find(s => s.isLeader);
    if (!leader) {
      setError('請指定一位組長');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: courseId,
          students: selectedStudents.map(s => ({
            studentId: s.id,
            role: s.role
          }))
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '新增分組失敗');
      }

      router.push(`/groups${courseId ? `?courseId=${courseId}` : ''}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : '新增分組失敗');
      console.error('新增分組錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!courseId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← 返回首頁
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">新增分組</h1>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          <div className="font-medium">缺少課程資訊</div>
          <div className="text-sm mt-1">
            請先回到首頁選擇課程，然後通過「分組管理」進入此頁面。
          </div>
          <Link
            href="/"
            className="inline-block mt-3 bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700 transition-colors"
          >
            返回首頁選擇課程
          </Link>
        </div>
      </div>
    );
  }

  if (loadingStudents) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">載入學生列表中...</div>
      </div>
    );
  }

  const availableStudents = students
    .filter(s => !selectedStudents.find(selected => selected.id === s.id))
    .filter(s => s.studentGroups.length === 0) // 只顯示沒有分組的學生
    .filter(s => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(query) || 
             s.studentId.toLowerCase().includes(query);
    });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← 返回首頁
          </Link>
          <Link
            href={`/groups${courseId ? `?courseId=${courseId}` : ''}`}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← 返回分組列表
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">新增分組</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 選擇學生 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">選擇學生</h2>
          
          {/* 搜尋框 */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋學生姓名或學號..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          {availableStudents.length === 0 ? (
            <div className="text-gray-500 text-center py-4">
              {searchQuery.trim() ? 
                '沒有符合搜尋條件且未分組的學生' : 
                (students.filter(s => s.studentGroups.length === 0).length === 0 ? 
                  '所有學生都已有組別' : 
                  (selectedStudents.length > 0 ? '剩餘未分組學生都已選擇' : '沒有未分組的學生')
                )
              }
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium text-gray-900">{student.name}</div>
                    <div className="text-sm text-gray-500">
                      {student.studentId} • {student.class}班
                    </div>
                  </div>
                  <button
                    onClick={() => addStudent(student)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                  >
                    選擇
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {searchQuery.trim() && (
            <div className="mt-3 text-sm text-gray-500">
              找到 {availableStudents.length} 位未分組學生
            </div>
          )}
        </div>

        {/* 已選學生和職位分配 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            分組成員 ({selectedStudents.length})
          </h2>
          
          {selectedStudents.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              請從左側選擇學生
            </div>
          ) : (
            <div className="space-y-4">
              {selectedStudents.map((student) => (
                <div
                  key={student.id}
                  className={`p-4 border rounded-lg ${
                    student.isLeader 
                      ? 'border-yellow-300 bg-yellow-50' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900">{student.name}</div>
                        {student.isLeader && (
                          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                            組長
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{student.studentId}</div>
                    </div>
                    <button
                      onClick={() => removeStudent(student.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      移除
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        職位
                      </label>
                      <select
                        value={student.role}
                        onChange={(e) => updateStudentRole(student.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {AVAILABLE_ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>

                    {!student.isLeader && (
                      <button
                        onClick={() => setLeader(student.id)}
                        className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200 transition-colors"
                      >
                        設為組長
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 提交按鈕 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <form onSubmit={handleSubmit}>
          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={loading || selectedStudents.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? '建立中...' : '建立分組'}
            </button>
            <Link
              href={`/groups${courseId ? `?courseId=${courseId}` : ''}`}
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