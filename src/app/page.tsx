'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { useAuth } from '@/components/AuthProvider';

interface Course {
  id: string;
  name: string;
  code?: string;
  description?: string;
  hasClassDivision?: boolean;
  allowStudentGrouping?: boolean;
  _count?: {
    students: number;
    groups: number;
    gradeItems: number;
  };
}

interface DeleteInfo {
  course: Course;
  grades: number;
}

export default function HomePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 課程 Modal 相關
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    hasClassDivision: false,
    allowStudentGrouping: true,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 刪除確認 Modal
  const [deletingCourse, setDeletingCourse] = useState<DeleteInfo | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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

  const openCreateModal = () => {
    setEditingCourse(null);
    setFormData({ name: '', code: '', description: '', hasClassDivision: false, allowStudentGrouping: true });
    setFormError(null);
    setShowCourseModal(true);
  };

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      code: course.code || '',
      description: course.description || '',
      hasClassDivision: course.hasClassDivision || false,
      allowStudentGrouping: course.allowStudentGrouping !== false,
    });
    setFormError(null);
    setShowCourseModal(true);
  };

  const handleSubmitCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('課程名稱為必填');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);

      const url = editingCourse
        ? `/api/courses/${editingCourse.id}`
        : '/api/courses';
      const method = editingCourse ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '操作失敗');
      }

      setShowCourseModal(false);
      await fetchCourses();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '操作失敗');
    } finally {
      setFormLoading(false);
    }
  };

  const openDeleteModal = async (course: Course) => {
    try {
      // 取得成績數量
      const res = await fetch(`/api/courses/${course.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 計算成績數量 - 從 gradeItems 取得
      const gradesRes = await fetch(`/api/grades?courseId=${course.id}`);
      let gradesCount = 0;
      if (gradesRes.ok) {
        const gradesData = await gradesRes.json();
        gradesCount = Array.isArray(gradesData) ? gradesData.length : 0;
      }

      setDeletingCourse({
        course: { ...course, _count: data._count },
        grades: gradesCount,
      });
      setDeleteConfirmText('');
    } catch (error) {
      setError(error instanceof Error ? error.message : '獲取課程資訊失敗');
    }
  };

  const handleDeleteCourse = async () => {
    if (!deletingCourse) return;
    try {
      setDeleteLoading(true);
      const response = await fetch(`/api/courses/${deletingCourse.course.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '刪除失敗');
      }

      setDeletingCourse(null);
      if (selectedCourseId === deletingCourse.course.id) {
        setSelectedCourseId('');
      }
      await fetchCourses();
    } catch (error) {
      setError(error instanceof Error ? error.message : '刪除課程失敗');
    } finally {
      setDeleteLoading(false);
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
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-semibold">選擇課程</h2>
          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              + 新增課程
            </button>
          )}
        </div>
        {courses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {isAdmin
              ? '尚無課程資料，請點擊上方按鈕新增課程'
              : '尚無課程資料，請聯繫老師建立課程'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => setSelectedCourseId(course.id)}
                className={`relative p-4 border rounded-lg text-left transition-colors ${
                  selectedCourseId === course.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {/* 編輯/刪除按鈕 */}
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(course);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.stopPropagation(); openEditModal(course); }
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                      title="編輯課程"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(course);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.stopPropagation(); openDeleteModal(course); }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title="刪除課程"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </span>
                  </div>
                )}
                <div className="flex items-start justify-between mb-2 pr-16">
                  <h3 className="font-medium text-gray-900">{course.name}</h3>
                </div>
                {course.code && (
                  <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mb-2">
                    {course.code}
                  </span>
                )}
                {course.description && (
                  <p className="text-sm text-gray-600 mb-3">{course.description}</p>
                )}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>學生: {course._count?.students || 0}</span>
                  <span>分組: {course._count?.groups || 0}</span>
                  <span>項目: {course._count?.gradeItems || 0}</span>
                </div>
                {(course.hasClassDivision || course.allowStudentGrouping === false) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {course.hasClassDivision && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        A/B 分班
                      </span>
                    )}
                    {course.allowStudentGrouping === false && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                        學生分組已關閉
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 系統功能區域 */}
      {selectedCourse && (
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold mb-4">
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

      {/* 新增/編輯課程 Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl p-4 md:p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingCourse ? '編輯課程' : '新增課程'}
            </h3>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 text-sm">
                {formError}
              </div>
            )}
            <form onSubmit={handleSubmitCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  課程名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="例：3D電腦繪圖"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  課程代碼（選填）
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="例：IC335"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  課程描述（選填）
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="課程簡介"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasClassDivision"
                  checked={formData.hasClassDivision}
                  onChange={(e) => setFormData({ ...formData, hasClassDivision: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="hasClassDivision" className="text-sm font-medium text-gray-700">
                  啟用 A/B 分班
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allowStudentGrouping"
                  checked={formData.allowStudentGrouping}
                  onChange={(e) => setFormData({ ...formData, allowStudentGrouping: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="allowStudentGrouping" className="text-sm font-medium text-gray-700">
                  允許學生自助分組
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {formLoading ? '處理中...' : editingCourse ? '更新' : '建立'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 刪除確認 Modal */}
      {deletingCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl p-4 md:p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-red-600 mb-4">
              確定要刪除課程？
            </h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="font-medium text-red-800 mb-2">
                即將刪除「{deletingCourse.course.name}」及其所有關聯資料：
              </p>
              <ul className="text-sm text-red-700 space-y-1">
                <li>- {deletingCourse.course._count?.students || 0} 位學生記錄</li>
                <li>- {deletingCourse.course._count?.groups || 0} 個分組</li>
                <li>- {deletingCourse.course._count?.gradeItems || 0} 個成績項目</li>
                <li>- {deletingCourse.grades} 筆成績記錄</li>
              </ul>
              <p className="text-sm text-red-800 font-medium mt-3">
                此操作無法復原！
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                請輸入課程名稱「<span className="text-red-600">{deletingCourse.course.name}</span>」以確認刪除：
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="輸入課程名稱"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingCourse(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteCourse}
                disabled={deleteLoading || deleteConfirmText !== deletingCourse.course.name}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 transition-colors"
              >
                {deleteLoading ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
