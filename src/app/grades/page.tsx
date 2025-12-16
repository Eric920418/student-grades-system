'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Student {
  id: string;
  name: string;
  studentId: string;
  course?: {
    name: string;
    code?: string;
  };
}

interface GradeItem {
  id: string;
  name: string;
  weight: number;
  maxScore: number;
}

interface Grade {
  id: string;
  score: number;
  studentId: string;
  gradeItemId: string;
  student: Student;
  gradeItem: GradeItem;
}

interface Group {
  id: string;
  name: string;
  studentGroups: Array<{
    studentId: string;
    student: Student;
  }>;
}

interface StudentGradeData {
  student: Student;
  grades: { [gradeItemId: string]: number };
  totalScore: number;
}

export default function GradesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGradeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [mode, setMode] = useState<'individual' | 'group'>('individual');
  const [selectedGradeItemId, setSelectedGradeItemId] = useState<string>('');
  const [editingGrade, setEditingGrade] = useState<{studentId: string, gradeItemId: string, score: string} | null>(null);
  const [editingGroupGrade, setEditingGroupGrade] = useState<{groupId: string, gradeItemId: string, score: string} | null>(null);
  const [groupSearchQuery, setGroupSearchQuery] = useState<string>('');

  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  // 自動選擇第一個成績項目
  useEffect(() => {
    if (gradeItems.length > 0 && !selectedGradeItemId) {
      setSelectedGradeItemId(gradeItems[0].id);
    }
  }, [gradeItems]);

  useEffect(() => {
    fetchAllData();
  }, [courseId]);

  useEffect(() => {
    calculateStudentGrades();
  }, [students, gradeItems, grades]);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // 建構查詢參數
      const params = new URLSearchParams();
      if (courseId) params.append('courseId', courseId);
      const queryString = params.toString();

      const [studentsResponse, gradeItemsResponse, gradesResponse, groupsResponse] = await Promise.all([
        fetch(`/api/students${queryString ? '?' + queryString : ''}`),
        fetch(`/api/grade-items${queryString ? '?' + queryString : ''}`),
        fetch(`/api/grades${queryString ? '?' + queryString : ''}`),
        fetch(`/api/groups${queryString ? '?' + queryString : ''}`)
      ]);

      const [studentsData, gradeItemsData, gradesData, groupsData] = await Promise.all([
        studentsResponse.json(),
        gradeItemsResponse.json(),
        gradesResponse.json(),
        groupsResponse.json()
      ]);

      if (!studentsResponse.ok) throw new Error(studentsData.error || '獲取學生列表失敗');
      if (!gradeItemsResponse.ok) throw new Error(gradeItemsData.error || '獲取成績項目失敗');
      if (!gradesResponse.ok) throw new Error(gradesData.error || '獲取成績列表失敗');
      if (!groupsResponse.ok) throw new Error(groupsData.error || '獲取分組列表失敗');

      setStudents(studentsData);
      setGradeItems(gradeItemsData);
      setGrades(gradesData);
      setGroups(groupsData);

      // 設定課程名稱
      if (studentsData.length > 0 && studentsData[0].course) {
        setCourseName(studentsData[0].course.name);
      }

      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : '載入資料失敗');
      console.error('載入資料錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStudentGrades = () => {
    const studentGradeMap: { [studentId: string]: StudentGradeData } = {};
    
    // 初始化每個學生的數據
    students.forEach(student => {
      studentGradeMap[student.id] = {
        student,
        grades: {},
        totalScore: 0
      };
    });

    // 填入成績
    grades.forEach(grade => {
      if (studentGradeMap[grade.studentId]) {
        studentGradeMap[grade.studentId].grades[grade.gradeItemId] = grade.score;
      }
    });

    // 計算總成績
    Object.values(studentGradeMap).forEach(studentData => {
      let totalWeightedScore = 0;
      let totalWeight = 0;

      gradeItems.forEach(item => {
        if (studentData.grades[item.id] !== undefined) {
          const normalizedScore = (studentData.grades[item.id] / item.maxScore) * 100;
          totalWeightedScore += normalizedScore * item.weight;
          totalWeight += item.weight;
        }
      });

      studentData.totalScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    });

    setStudentGrades(Object.values(studentGradeMap));
  };

  const handleGradeEdit = (studentId: string, gradeItemId: string) => {
    const currentGrade = grades.find(g => g.studentId === studentId && g.gradeItemId === gradeItemId);
    setEditingGrade({
      studentId,
      gradeItemId,
      score: currentGrade ? currentGrade.score.toString() : ''
    });
  };

  const handleGradeSave = async () => {
    if (!editingGrade) return;

    try {
      const response = await fetch('/api/grades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: editingGrade.studentId,
          gradeItemId: editingGrade.gradeItemId,
          score: parseFloat(editingGrade.score)
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '儲存成績失敗');
      }

      await fetchAllData();
      setEditingGrade(null);
      setError(null);
      setSuccessMessage('成績已儲存');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : '儲存成績失敗');
      console.error('儲存成績錯誤:', error);
    }
  };

  const handleGroupGradeEdit = (groupId: string, gradeItemId: string) => {
    setEditingGroupGrade({
      groupId,
      gradeItemId,
      score: ''
    });
  };

  const handleGroupGradeSave = async () => {
    if (!editingGroupGrade) return;

    try {
      const response = await fetch('/api/grades/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId: editingGroupGrade.groupId,
          gradeItemId: editingGroupGrade.gradeItemId,
          score: parseFloat(editingGroupGrade.score)
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorDetails = data.details ? `\n詳細信息: ${data.details}` : '';
        const errorStack = data.stack ? `\n堆疊追蹤:\n${data.stack}` : '';
        throw new Error(`${data.error || '儲存分組成績失敗'}${errorDetails}${errorStack}`);
      }

      await fetchAllData();
      setEditingGroupGrade(null);
      setError(null);
      setSuccessMessage(data.message || '分組成績已儲存');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '儲存分組成績失敗';
      setError(errorMessage);
      console.error('儲存分組成績錯誤:', error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">載入中...</div>
      </div>
    );
  }

  if (students.length === 0 || gradeItems.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 space-y-2">
          <p>請先新增學生和成績項目</p>
          <div className="space-x-4">
            <a href="/students" className="text-blue-600 hover:underline">新增學生</a>
            <a href="/grade-items" className="text-blue-600 hover:underline">新增成績項目</a>
          </div>
        </div>
      </div>
    );
  }

  const selectedGradeItem = gradeItems.find(item => item.id === selectedGradeItemId);

  // 過濾已評分的組別：如果組內所有成員都已經有該項目成績，則隱藏該組
  const getUnfinishedGroups = () => {
    if (!selectedGradeItemId) return groups;

    return groups.filter(group => {
      // 檢查該組是否有成員
      if (group.studentGroups.length === 0) return false;

      // 檢查是否所有成員都已經有該成績項目的分數
      const allMembersGraded = group.studentGroups.every(sg => {
        return grades.some(grade =>
          grade.studentId === sg.studentId &&
          grade.gradeItemId === selectedGradeItemId
        );
      });

      // 如果所有成員都已評分，則不顯示（返回false）
      // 如果還有成員未評分，則顯示（返回true）
      return !allMembersGraded;
    });
  };

  const unfinishedGroups = getUnfinishedGroups();

  // 搜尋學號對應的組別
  const getSearchedGroups = () => {
    if (!groupSearchQuery.trim()) return unfinishedGroups;

    const query = groupSearchQuery.trim().toLowerCase();
    return unfinishedGroups.filter(group =>
      group.studentGroups.some(sg =>
        sg.student.studentId.toLowerCase().includes(query)
      )
    );
  };

  const searchedGroups = getSearchedGroups();

  // 檢查學號是否匹配搜尋
  const isStudentMatch = (studentId: string) => {
    if (!groupSearchQuery.trim()) return false;
    return studentId.toLowerCase().includes(groupSearchQuery.trim().toLowerCase());
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            成績登記
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

        {/* 模式切換 */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setMode('individual')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'individual'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            個人模式
          </button>
          <button
            onClick={() => setMode('group')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'group'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            分組模式
          </button>
        </div>
      </div>

      {/* 成績項目選擇器 */}
      {gradeItems.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <label htmlFor="gradeItem" className="block text-sm font-medium text-gray-700 mb-2">
            選擇要登記的成績項目：
          </label>
          <select
            id="gradeItem"
            value={selectedGradeItemId}
            onChange={(e) => setSelectedGradeItemId(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {gradeItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} (權重: {(item.weight * 100).toFixed(0)}% | 滿分: {item.maxScore})
              </option>
            ))}
          </select>
          {selectedGradeItem && (
            <div className="mt-2 text-sm text-gray-600">
              目前登記：<strong className="text-blue-600">{selectedGradeItem.name}</strong> - 滿分 {selectedGradeItem.maxScore} 分，權重 {(selectedGradeItem.weight * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <pre className="whitespace-pre-wrap text-sm font-mono">{error}</pre>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {/* 個人模式 */}
      {mode === 'individual' && selectedGradeItem && (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                  學號 / 姓名
                </th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-700">
                  {selectedGradeItem.name} 成績
                </th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-700">
                  總成績（所有項目）
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {studentGrades.map((studentData) => (
                <tr key={studentData.student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {studentData.student.studentId}
                    </div>
                    <div className="text-sm text-gray-500">
                      {studentData.student.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {editingGrade?.studentId === studentData.student.id &&
                     editingGrade?.gradeItemId === selectedGradeItemId ? (
                      <div className="flex items-center justify-center space-x-2">
                        <input
                          type="number"
                          value={editingGrade.score}
                          onChange={(e) => setEditingGrade({
                            ...editingGrade,
                            score: e.target.value
                          })}
                          className="w-24 px-3 py-2 text-center border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          max={selectedGradeItem.maxScore}
                          step="0.1"
                          placeholder="輸入分數"
                          autoFocus
                        />
                        <button
                          onClick={handleGradeSave}
                          className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm"
                        >
                          確定
                        </button>
                        <button
                          onClick={() => setEditingGrade(null)}
                          className="bg-gray-400 text-white px-3 py-2 rounded-lg hover:bg-gray-500 text-sm"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGradeEdit(studentData.student.id, selectedGradeItemId)}
                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors min-w-[100px]"
                      >
                        <div className="text-base font-medium">
                          {studentData.grades[selectedGradeItemId] !== undefined
                            ? studentData.grades[selectedGradeItemId].toFixed(1)
                            : '點擊登記'
                          }
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          {studentData.grades[selectedGradeItemId] !== undefined ? '點擊修改' : `滿分 ${selectedGradeItem.maxScore}`}
                        </div>
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={`text-lg font-bold ${
                      studentData.totalScore >= 90 ? 'text-green-600' :
                      studentData.totalScore >= 80 ? 'text-blue-600' :
                      studentData.totalScore >= 70 ? 'text-yellow-600' :
                      studentData.totalScore >= 60 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {studentData.totalScore.toFixed(1)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分組模式 */}
      {mode === 'group' && selectedGradeItem && (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          {/* 學號搜尋框 */}
          {groups.length > 0 && unfinishedGroups.length > 0 && (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <label htmlFor="groupSearch" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  🔍 學號查組：
                </label>
                <input
                  id="groupSearch"
                  type="text"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  placeholder="輸入學號快速查找組別..."
                  className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {groupSearchQuery && (
                  <button
                    onClick={() => setGroupSearchQuery('')}
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    清除
                  </button>
                )}
                {groupSearchQuery && (
                  <span className="text-sm text-gray-500">
                    找到 {searchedGroups.length} 組
                  </span>
                )}
              </div>
            </div>
          )}
          {groups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>此課程尚無分組，請先建立分組</p>
              <Link href={`/groups?courseId=${courseId}`} className="text-blue-600 hover:underline mt-2 inline-block">
                前往分組管理
              </Link>
            </div>
          ) : unfinishedGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-green-600 font-medium">✓ 所有分組都已完成「{selectedGradeItem.name}」的評分</p>
              <p className="mt-2 text-sm">請切換到其他成績項目，或返回個人模式查看成績</p>
            </div>
          ) : searchedGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>找不到包含學號「{groupSearchQuery}」的組別</p>
              <button
                onClick={() => setGroupSearchQuery('')}
                className="text-blue-600 hover:underline mt-2"
              >
                清除搜尋
              </button>
            </div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                    分組名稱 / 成員
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-700">
                    {selectedGradeItem.name} 成績
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {searchedGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 mb-2">
                        {group.name}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        {group.studentGroups.length} 位成員：
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {group.studentGroups.map((sg) => (
                          <span
                            key={sg.studentId}
                            className={`inline-block px-2 py-1 text-xs rounded border ${
                              isStudentMatch(sg.student.studentId)
                                ? 'bg-yellow-200 text-yellow-900 border-yellow-400 font-bold ring-2 ring-yellow-400'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {sg.student.studentId}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {editingGroupGrade?.groupId === group.id &&
                       editingGroupGrade?.gradeItemId === selectedGradeItemId ? (
                        <div className="flex items-center justify-center space-x-2">
                          <input
                            type="number"
                            value={editingGroupGrade.score}
                            onChange={(e) => setEditingGroupGrade({
                              ...editingGroupGrade,
                              score: e.target.value
                            })}
                            className="w-24 px-3 py-2 text-center border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                            max={selectedGradeItem.maxScore}
                            step="0.1"
                            placeholder="輸入分數"
                            autoFocus
                          />
                          <button
                            onClick={handleGroupGradeSave}
                            className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm"
                          >
                            確定
                          </button>
                          <button
                            onClick={() => setEditingGroupGrade(null)}
                            className="bg-gray-400 text-white px-3 py-2 rounded-lg hover:bg-gray-500 text-sm"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleGroupGradeEdit(group.id, selectedGradeItemId)}
                          className="px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors min-w-[200px]"
                        >
                          <div className="text-base font-medium">
                            點擊給整組評分
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            {group.studentGroups.length} 位成員將獲得相同成績
                          </div>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">使用說明</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>步驟 1</strong>：從上方下拉選單選擇要登記的成績項目（期中考、期末考等）</li>
          <li>• <strong>步驟 2</strong>：選擇登記模式：</li>
          <ul className="ml-4 space-y-1 mt-1">
            {mode === 'individual' ? (
              <>
                <li>✓ <strong>個人模式</strong>（當前）：逐一為每位學生登記成績</li>
                <li>  - 點擊「點擊登記」按鈕輸入分數</li>
                <li>  - 可查看每位學生的總成績（所有項目加權平均）</li>
              </>
            ) : (
              <>
                <li>✓ <strong>分組模式</strong>（當前）：批次為整組登記成績</li>
                <li>  - 點擊「給整組評分」按鈕</li>
                <li>  - 輸入分數後，整組成員將獲得相同成績</li>
                <li>  - 適合團隊作業、專題報告等情境</li>
              </>
            )}
          </ul>
          <li>• 總成績計算：Σ(各項目分數/滿分 × 100 × 權重) ÷ Σ權重</li>
        </ul>
      </div>
    </div>
  );
}