'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

interface DiscoveredCourse {
  pageId: string;
  name: string;
  cosId?: string;
  cosClass?: string;
  year?: string;
  semester?: string;
  isInstructor?: boolean;
  studentCount?: number;
  error?: string;
}

interface ImportResult {
  created: number;
  updated: number;
  triggered: Array<{ course: string; jobId: string }>;
  errors: string[];
}

export default function PortalCoursesPage() {
  const [discovering, setDiscovering] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [courses, setCourses] = useState<DiscoveredCourse[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [divisions, setDivisions] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const handleDiscover = async () => {
    setError(null);
    setCourses(null);
    setImportResult(null);
    setSelected(new Set());
    setDivisions(new Set());
    try {
      setDiscovering(true);
      setStatusText('觸發探索中…');
      const res = await fetch('/api/portal-sync/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'discover' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? `${data.error}：${data.details}` : data.error);

      const jobId = data.jobId as string;
      setStatusText('worker 登入 portalx、逐門課讀取中…（約 1–3 分鐘）');
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/portal-sync/jobs?jobId=${jobId}`);
          const arr = await r.json();
          const job = Array.isArray(arr) ? arr[0] : null;
          if (!job) return;
          if (job.status === 'success') {
            stopPoll();
            setDiscovering(false);
            const list: DiscoveredCourse[] = job.resultJson ? JSON.parse(job.resultJson) : [];
            setCourses(list);
            // 預設勾選「你是老師」的課
            const presel = new Set<number>();
            list.forEach((c, i) => {
              if (c.isInstructor) presel.add(i);
            });
            setSelected(presel);
            setStatusText('');
          } else if (job.status === 'failed') {
            stopPoll();
            setDiscovering(false);
            setError(job.message || '探索失敗');
            setStatusText('');
          }
        } catch {
          /* 輪詢失敗靜默重試 */
        }
      }, 4000);
    } catch (err) {
      setDiscovering(false);
      setError(err instanceof Error ? err.message : '觸發探索失敗');
      setStatusText('');
    }
  };

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };
  const toggleDivision = (i: number) => {
    setDivisions((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleImport = async () => {
    if (!courses) return;
    setError(null);
    const picks = Array.from(selected)
      .map((i) => ({ i, c: courses[i] }))
      .filter(({ c }) => c && c.cosId)
      .map(({ i, c }) => ({
        name: c.name,
        cosId: c.cosId!,
        year: c.year || '',
        semester: c.semester || '',
        hasClassDivision: divisions.has(i),
      }));
    if (picks.length === 0) {
      setError('請至少勾選一門有抓到課號的課程');
      return;
    }
    try {
      setImporting(true);
      const res = await fetch('/api/portal-sync/discover-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? `${data.error}：${data.details}` : data.error);
      setImportResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入失敗');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">從 portal 匯入課程</h1>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          自動登入 portalx、列出你帳號裡的所有課程（標示你是「老師」還是「學生」），你勾選後系統會
          <strong>自動建立課程並撈名單</strong>（乾跑，不寫入）。預設只勾選你是授課老師的課。
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg whitespace-pre-line">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4">
        <button
          onClick={handleDiscover}
          disabled={discovering}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {discovering ? '探索中…' : '🔍 探索我的 portal 課程'}
        </button>
        {statusText && <p className="text-sm text-gray-500">{statusText}</p>}
      </div>

      {courses && (
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            發現 {courses.length} 門課程（勾選要建立＋撈名單的）
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">建立</th>
                  <th className="px-3 py-2 text-left">課名</th>
                  <th className="px-3 py-2 text-left">課號</th>
                  <th className="px-3 py-2 text-left">學期</th>
                  <th className="px-3 py-2 text-left">你的身分</th>
                  <th className="px-3 py-2 text-left">A/B 分班</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {courses.map((c, i) => (
                  <tr key={i} className={c.error ? 'opacity-50' : ''}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        disabled={!c.cosId}
                        onChange={() => toggle(i)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                    </td>
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2 font-mono">{c.cosId || '—'}</td>
                    <td className="px-3 py-2">{c.year && c.semester ? `${c.year}/${c.semester}` : '—'}</td>
                    <td className="px-3 py-2">
                      {c.error ? (
                        <span className="text-red-600 text-xs">讀取失敗</span>
                      ) : c.isInstructor ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">老師</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">學生</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={divisions.has(i)}
                        disabled={!selected.has(i)}
                        onChange={() => toggleDivision(i)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        title="此課程有 A/B 兩班，撈名單時兩班都抓"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || selected.size === 0}
            className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {importing ? '處理中…' : `✅ 建立勾選的 ${selected.size} 門課程並撈名單（乾跑）`}
          </button>
        </div>
      )}

      {importResult && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm space-y-1">
          <div className="font-medium">✅ 完成</div>
          <div>新建 {importResult.created} 門、更新對應 {importResult.updated} 門、已觸發名單同步 {importResult.triggered.length} 門（乾跑）。</div>
          <div className="text-gray-600">
            各課的名單抓取結果，請到該課程的
            <Link href="/" className="text-blue-600 hover:underline mx-1">課程頁</Link>
            → 校務同步 查看。
          </div>
          {importResult.errors.length > 0 && (
            <div className="text-red-700 whitespace-pre-line mt-2">{importResult.errors.join('\n')}</div>
          )}
        </div>
      )}
    </div>
  );
}
