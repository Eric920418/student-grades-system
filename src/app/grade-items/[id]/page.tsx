'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { buildFillScript } from '@/lib/portalSync';

interface GradeDetail {
  id: string;
  name: string;
  weight: number;
  maxScore: number;
  createdAt: string;
  course: {
    id: string;
    name: string;
    code?: string;
  };
  grades: Array<{
    score: number;
    student: {
      id: string;
      name: string;
      studentId: string;
      email?: string;
      class?: string;
    };
  }>;
}

interface Student {
  id: string;
  name: string;
  studentId: string;
  class?: string;
}

// \u5efa\u7acb { \u5b78\u865f: \u5206\u6578 } \u5c0d\u61c9\u3002\u672a\u767b\u8a18\u6210\u7e3e\u8005\uff1afillUnrecordedZero \u70ba true \u6642\u586b 0\uff0c\u5426\u5247\u4e0d\u653e\u9032 map\uff08\u8173\u672c\u6703\u8df3\u904e\uff09\u3002
// \u4e0d\u5728 allStudents\uff08\u672c\u73ed\u540d\u55ae\uff09\u88e1\u7684\u5b78\u751f\u6c38\u9060\u4e0d\u6703\u51fa\u73fe\u5728 map\uff0c\u8173\u672c\u56e0\u6b64\u4e0d\u6703\u8aa4\u586b\u975e\u672c\u73ed\u6210\u7e3e\u3002
function buildScoreMap(
  allStudents: Student[],
  grades: GradeDetail['grades'],
  fillUnrecordedZero: boolean
): Record<string, number> {
  const scoreMap = new Map(grades.map(g => [g.student.studentId, g.score]));
  const result: Record<string, number> = {};
  for (const s of allStudents) {
    if (scoreMap.has(s.studentId)) {
      result[s.studentId] = scoreMap.get(s.studentId)!;
    } else if (fillUnrecordedZero) {
      result[s.studentId] = 0;
    }
  }
  return result;
}

export default function GradeItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  const [gradeItem, setGradeItem] = useState<GradeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [fillUnrecordedZero, setFillUnrecordedZero] = useState(false);

  useEffect(() => {
    fetchGradeItemDetail();
  }, [params.id]);

  useEffect(() => {
    if (!gradeItem?.course.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/students?courseId=${gradeItem.course.id}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '獲取學生清單失敗');
        }
        setAllStudents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '獲取學生清單失敗');
      }
    })();
  }, [gradeItem?.course.id]);

  const handleCopyScript = async () => {
    if (!gradeItem) return;
    try {
      const scoreMap = buildScoreMap(allStudents, gradeItem.grades, fillUnrecordedZero);
      const scriptText = buildFillScript(scoreMap);
      await navigator.clipboard.writeText(scriptText);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      setCopyStatus('error');
      alert(`複製失敗：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const fetchGradeItemDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/grade-items/${params.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '獲取成績項目詳細信息失敗');
      }

      setGradeItem(data);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : '獲取成績項目詳細信息失敗');
      console.error('獲取成績項目詳細信息錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 檢查檔案類型
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx?|xls)$/i)) {
        setExportMessage({ type: 'error', text: '請上傳有效的 Excel 檔案（.xls 或 .xlsx）' });
        return;
      }
      setSelectedFile(file);
      setExportMessage(null);
    }
  };

  const handleExport = async () => {
    if (!selectedFile) {
      setExportMessage({ type: 'error', text: '請先選擇範本檔案' });
      return;
    }

    try {
      setExportLoading(true);
      setExportMessage(null);

      const formData = new FormData();
      formData.append('template', selectedFile);

      const response = await fetch(`/api/grade-items/${params.id}/export`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '導出失敗');
      }

      // 獲取導出統計資訊
      const updatedCount = response.headers.get('X-Updated-Count');
      const notFoundCount = response.headers.get('X-Not-Found-Count');
      const notFoundStudentsBase64 = response.headers.get('X-Not-Found-Students');

      // 解碼未找到的學號列表
      let notFoundStudents: string[] = [];
      if (notFoundStudentsBase64) {
        try {
          const decoded = atob(notFoundStudentsBase64);
          notFoundStudents = decoded.split(',').filter(s => s.trim());
        } catch (e) {
          console.error('解碼學號列表失敗:', e);
        }
      }

      // 下載檔案
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // 從 Content-Disposition 獲取檔案名稱
      const contentDisposition = response.headers.get('Content-Disposition');
      let fileName = '成績導出.xlsx';
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = decodeURIComponent(fileNameMatch[1].replace(/['"]/g, ''));
        }
      }

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // 顯示成功訊息
      let message = `成功導出！已填入 ${updatedCount} 位學生的成績`;
      if (notFoundStudents.length > 0) {
        message += `\n\n注意：範本中有 ${notFoundCount} 個學號在系統中找不到對應成績：\n${notFoundStudents.join(', ')}`;
      }
      setExportMessage({ type: 'success', text: message });

      // 清除已選檔案
      setSelectedFile(null);
    } catch (error) {
      console.error('導出錯誤:', error);
      setExportMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '導出失敗，請稍後再試',
      });
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">載入中...</div>
      </div>
    );
  }

  if (error || !gradeItem) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || '找不到該成績項目'}
        </div>
        <Link
          href={`/grade-items${courseId ? `?courseId=${courseId}` : ''}`}
          className="text-blue-600 hover:text-blue-800"
        >
          ← 返回成績項目列表
        </Link>
      </div>
    );
  }

  // 計算統計數據
  const totalStudents = gradeItem.grades.length;
  const avgScore = totalStudents > 0
    ? gradeItem.grades.reduce((sum, grade) => sum + grade.score, 0) / totalStudents
    : 0;
  const maxRecordedScore = totalStudents > 0
    ? Math.max(...gradeItem.grades.map(g => g.score))
    : 0;
  const minRecordedScore = totalStudents > 0
    ? Math.min(...gradeItem.grades.map(g => g.score))
    : 0;

  // 計算成績分布
  const getGradeLevel = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const gradeLevelDistribution = gradeItem.grades.reduce((acc, grade) => {
    const level = getGradeLevel(grade.score, gradeItem.maxScore);
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* 頂部導航 */}
      <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            成績項目詳細信息
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Link
              href={`/grade-items${courseId ? `?courseId=${courseId}` : ''}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← 返回成績項目列表
            </Link>
          </div>
        </div>
      </div>

      {/* 基本信息卡片 */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900">{gradeItem.name}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500">課程</div>
            <div className="text-lg font-medium text-gray-900">
              {gradeItem.course.name}
              {gradeItem.course.code && (
                <span className="text-sm text-gray-500 ml-2">({gradeItem.course.code})</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">滿分</div>
            <div className="text-lg font-medium text-gray-900">{gradeItem.maxScore}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">創建時間</div>
            <div className="text-lg font-medium text-gray-900">
              {new Date(gradeItem.createdAt).toLocaleDateString('zh-TW')}
            </div>
          </div>
        </div>
      </div>

      {/* 統計信息卡片 */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">統計信息</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 md:p-4">
            <div className="text-sm text-blue-600">已登記人數</div>
            <div className="text-xl md:text-2xl font-bold text-blue-900">{totalStudents}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 md:p-4">
            <div className="text-sm text-green-600">平均分數</div>
            <div className="text-xl md:text-2xl font-bold text-green-900">
              {avgScore.toFixed(1)}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 md:p-4">
            <div className="text-sm text-purple-600">最高分</div>
            <div className="text-xl md:text-2xl font-bold text-purple-900">
              {totalStudents > 0 ? maxRecordedScore.toFixed(1) : '-'}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 md:p-4">
            <div className="text-sm text-orange-600">最低分</div>
            <div className="text-xl md:text-2xl font-bold text-orange-900">
              {totalStudents > 0 ? minRecordedScore.toFixed(1) : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Excel 導出功能 */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 導出成績到 Excel</h3>

        <div className="space-y-4">
          {/* 檔案選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              選擇 Excel 範本檔案
            </label>
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-green-600">
                已選擇：{selectedFile.name}
              </p>
            )}
          </div>

          {/* 導出按鈕 */}
          <button
            onClick={handleExport}
            disabled={!selectedFile || exportLoading}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-medium
              hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed
              transition-colors"
          >
            {exportLoading ? '導出中...' : '🎯 開始導出成績'}
          </button>

          {/* 訊息顯示 */}
          {exportMessage && (
            <div
              className={`rounded-lg p-4 ${
                exportMessage.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              <div className="font-medium mb-1">
                {exportMessage.type === 'success' ? '✅ 成功' : '❌ 錯誤'}
              </div>
              <div className="text-sm whitespace-pre-line">{exportMessage.text}</div>
            </div>
          )}
        </div>
      </div>

      {/* 複製 JS 腳本（校務系統填分用） */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 複製填分腳本（校務系統 portalx 用）</h3>

        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            全班共 <span className="font-semibold">{allStudents.length}</span> 人，已登記{' '}
            <span className="font-semibold text-green-600">{gradeItem.grades.length}</span> 人，
            未登記 <span className="font-semibold text-orange-600">{Math.max(0, allStudents.length - gradeItem.grades.length)}</span> 人。
            <br />
            腳本以<strong>學號</strong>比對欄位填入，不依賴排序；找不到對應學號的列會自動跳過，不會誤填非本班學生。
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={fillUnrecordedZero}
              onChange={(e) => setFillUnrecordedZero(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            未登記成績的學生也填入 <span className="font-mono">0</span> 分
            <span className="text-gray-400">（預設不勾：跳過不填，避免覆蓋校務系統上既有分數）</span>
          </label>

          <button
            onClick={handleCopyScript}
            disabled={allStudents.length === 0}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium
              hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
              transition-colors"
          >
            {copyStatus === 'copied' ? '已複製 ✓' : '📋 複製腳本到剪貼簿'}
          </button>

          <div className="text-xs text-gray-500 leading-relaxed">
            💡 使用方式：登入校務系統 → 開啟該成績項目的成績登錄頁 → 按 <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">F12</kbd> 開啟 DevTools → 切到 <strong>Console</strong> 分頁 → 貼上腳本 → <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">Enter</kbd> 執行。
            <br />
            執行後會跳出統計（已填入幾筆、哪些學號找不到欄位）。<strong>提交成績前請先核對統計數字</strong>，建議先用少數學號試填確認無誤再全班執行。
            <br />
            若頁面結構特殊導致對不到，可在腳本最上方的 <span className="font-mono">CONFIG</span> 調整 selector 與學號正則。
          </div>
        </div>
      </div>

      {/* 學生成績列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">學生成績列表</h3>
        </div>

        {gradeItem.grades.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            尚無學生成績記錄
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    學號
                  </th>
                  <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    姓名
                  </th>
                  <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    班級
                  </th>
                  <th className="px-3 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    分數
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {gradeItem.grades.map((grade) => {
                  const percentage = (grade.score / gradeItem.maxScore) * 100;
                  const level = getGradeLevel(grade.score, gradeItem.maxScore);

                  const levelColors: Record<string, string> = {
                    'A': 'bg-green-100 text-green-800',
                    'B': 'bg-blue-100 text-blue-800',
                    'C': 'bg-yellow-100 text-yellow-800',
                    'D': 'bg-orange-100 text-orange-800',
                    'F': 'bg-red-100 text-red-800'
                  };

                  return (
                    <tr key={grade.student.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-900">
                        {grade.student.studentId}
                      </td>
                      <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {grade.student.name}
                      </td>
                      <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500">
                        {grade.student.class || '-'}
                      </td>
                      <td className="px-3 py-3 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-900">
                        {grade.score.toFixed(1)} / {gradeItem.maxScore}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
