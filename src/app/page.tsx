'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";

interface Course {
  id: string;
  name: string;
  code?: string;
  description?: string;
  _count?: {
    students: number;
    groups: number;
    gradeItems: number;
  };
}

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/courses');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '獲取課程列表失敗');
      }
      
      setCourses(data);
      // 自動選擇第一個課程
      if (data.length > 0 && !selectedCourseId) {
        setSelectedCourseId(data[0].id);
      }
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : '獲取課程列表失敗');
      console.error('獲取課程列表錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  return (
    <div className="space-y-6">
      {/* 課程選擇區域 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">選擇課程</h2>
        {courses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            尚無課程資料，請聯繫管理員建立課程
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => setSelectedCourseId(course.id)}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  selectedCourseId === course.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{course.name}</h3>
                </div>
                {course.description && (
                  <p className="text-sm text-gray-600 mb-3">{course.description}</p>
                )}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>學生: {course._count?.students || 0}</span>
                  <span>分組: {course._count?.groups || 0}</span>
                  <span>項目: {course._count?.gradeItems || 0}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 系統功能區域 */}
      {selectedCourse && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">
            {selectedCourse.name} - 系統功能
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href={`/students?courseId=${selectedCourseId}`}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-900">學生管理</h3>
              <p className="text-sm text-gray-600 mt-1">新增、編輯、查看學生資料</p>
              <div className="text-xs text-blue-600 mt-2">
                {selectedCourse._count?.students || 0} 位學生
              </div>
            </Link>
            
            <Link
              href={`/groups?courseId=${selectedCourseId}`}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-900">分組管理</h3>
              <p className="text-sm text-gray-600 mt-1">建立分組、分配學生</p>
              <div className="text-xs text-blue-600 mt-2">
                {selectedCourse._count?.groups || 0} 個分組
              </div>
            </Link>
            
            <Link
              href={`/grade-items?courseId=${selectedCourseId}`}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-900">成績項目</h3>
              <p className="text-sm text-gray-600 mt-1">設置評分項目和權重</p>
              <div className="text-xs text-blue-600 mt-2">
                {selectedCourse._count?.gradeItems || 0} 個項目
              </div>
            </Link>
            
            <Link
              href={`/grades?courseId=${selectedCourseId}`}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-900">成績登記</h3>
              <p className="text-sm text-gray-600 mt-1">記錄和查看學生成績</p>
              <div className="text-xs text-blue-600 mt-2">點擊進入</div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}