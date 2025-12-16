'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Student {
  id: string;
  name: string;
  studentId: string;
  email?: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  studentGroups: Array<{
    student: Student;
    role?: string;
  }>;
}

export default function ManageGroupStudentsPage({ params }: { params: { id: string } }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<{id: string, role?: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [groupResponse, studentsResponse] = await Promise.all([
        fetch(`/api/groups/${params.id}`),
        fetch('/api/students')
      ]);

      const [groupData, studentsData] = await Promise.all([
        groupResponse.json(),
        studentsResponse.json()
      ]);

      if (!groupResponse.ok) {
        throw new Error(groupData.error || '獲取分組資料失敗');
      }

      if (!studentsResponse.ok) {
        throw new Error(studentsData.error || '獲取學生列表失敗');
      }

      setGroup(groupData);
      setAllStudents(studentsData);
      setSelectedStudents(groupData.studentGroups.map((sg: any) => ({
        id: sg.student.id,
        role: sg.role
      })));
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : '載入資料失敗');
      console.error('載入資料錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev => {
      const existingIndex = prev.findIndex(s => s.id === studentId);
      if (existingIndex >= 0) {
        return prev.filter(s => s.id !== studentId);
      } else {
        return [...prev, { id: studentId, role: undefined }];
      }
    });
  };

  const handleRoleChange = (studentId: string, role: string) => {
    setSelectedStudents(prev =>
      prev.map(s =>
        s.id === studentId ? { ...s, role: role || undefined } : s
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/groups/${params.id}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          students: selectedStudents
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '分配學生失敗');
      }

      router.push('/groups');
    } catch (error) {
      setError(error instanceof Error ? error.message : '分配學生失敗');
      console.error('分配學生錯誤:', error);
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
        <div className="text-red-600">找不到分組資料</div>
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
            href="/groups"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← 返回分組列表
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">管理分組學生 - {group.name}</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">選擇學生加入分組</h2>
          <p className="text-sm text-gray-600">
            已選擇 {selectedStudents.length} 位學生
          </p>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {allStudents.length === 0 ? (
            <div className="text-gray-500 text-center py-4">
              尚無學生資料，請先新增學生
            </div>
          ) : (
            allStudents.map((student) => {
              const isSelected = selectedStudents.some(s => s.id === student.id);
              const selectedStudent = selectedStudents.find(s => s.id === student.id);
              
              return (
                <div
                  key={student.id}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <input
                      type="checkbox"
                      id={`student-${student.id}`}
                      checked={isSelected}
                      onChange={() => handleStudentToggle(student.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`student-${student.id}`} className="flex-grow cursor-pointer">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium text-gray-900">{student.name}</span>
                          <span className="text-gray-500 ml-2">({student.studentId})</span>
                        </div>
                        {student.email && (
                          <span className="text-sm text-gray-500">{student.email}</span>
                        )}
                      </div>
                    </label>
                  </div>
                  
                  {isSelected && (
                    <div className="ml-7 flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-700">
                        職位：
                      </label>
                      <select
                        value={selectedStudent?.role || ''}
                        onChange={(e) => handleRoleChange(student.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">未指定</option>
                        <option value="導演">導演</option>
                        <option value="模型">模型</option>
                        <option value="後製">後製</option>
                        <option value="動畫">動畫</option>
                      </select>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex space-x-4 pt-6 border-t">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {saving ? '儲存中...' : '儲存分組'}
          </button>
          <Link
            href="/groups"
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            取消
          </Link>
        </div>
      </div>
    </div>
  );
}