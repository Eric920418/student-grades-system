'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface ScrapedStudent {
  studentId: string;
  name: string;
  email?: string;
  withdrawn?: boolean;
}
interface DiscoveredCourse {
  name: string;
  cosId?: string;
  cosClass?: string;
  year?: string;
  semester?: string;
  isInstructor?: boolean;
  students?: ScrapedStudent[];
  error?: string;
}
interface ImportResult {
  courses: Array<{ name: string; created: number; skipped: number; conflicts: number }>;
  coursesCreated: number;
  coursesUpdated: number;
  errors: string[];
}

export default function PortalCoursesPage() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get('job');

  const [courses, setCourses] = useState<DiscoveredCourse[] | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [divisions, setDivisions] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      // 有帶 ?job= 用該筆；否則自動載入最近一次插件撈取結果
      const url = jobId
        ? `/api/portal-sync/jobs?jobId=${jobId}`
        : `/api/portal-sync/jobs?latestKind=discover`;
      const res = await fetch(url);
      const arr = await res.json();
      const job = Array.isArray(arr) ? arr[0] : null;
      if (!job) { setCourses(null); return; } // 還沒有任何撈取資料
      if (!job.resultJson) throw new Error('這筆同步沒有課程資料');
      setActiveJobId(job.id);
      const list: DiscoveredCourse[] = JSON.parse(job.resultJson);
      setCourses(list);
      const presel = new Set<number>();
      list.forEach((c, i) => { if (c.isInstructor && c.cosId) presel.add(i); });
      setSelected(presel);
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取失敗');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const toggle = (i: number) => setSelected((p) => {
    const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n;
  });
  const toggleDivision = (i: number) => setDivisions((p) => {
    const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n;
  });

  const handleImport = async () => {
    if (!courses || !activeJobId) return;
    setError(null);
    const picks = Array.from(selected).map((index) => ({ index, hasClassDivision: divisions.has(index) }));
    if (picks.length === 0) { setError('請至少勾選一門課'); return; }
    try {
      setImporting(true);
      const res = await fetch('/api/portal-sync/extension-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeJobId, picks }),
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

  const handleClearDiscover = async () => {
    if (!confirm('清除這份爬取預覽清單？\n（只清掉預覽，不會刪除任何已建立的課程或學生）')) return;
    setError(null);
    try {
      setClearing(true);
      const res = await fetch('/api/portal-sync/jobs?kind=discover', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? `${data.error}：${data.details}` : data.error);
      setCourses(null);
      setImportResult(null);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : '清除失敗');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">從 portal 匯入課程</h1>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          在 Chrome 用<strong>「成績系統 — portalx 同步」插件</strong>（先登入 portalx 再按同步）即可自動爬取所有課程與名單，
          完成後會帶你回到這頁。勾選要建立的課（預設只勾你是授課老師的），按下方按鈕即建課＋寫名單（只新增、不覆蓋）。
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg whitespace-pre-line">{error}</div>
      )}

      {!loading && !courses && !error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
          尚未有同步資料。請先在 Chrome 點插件 →「🔄 同步課程到成績系統」，完成後這頁會自動顯示最近一次的撈取結果。
        </div>
      )}

      {loading && <div className="text-gray-500 text-sm">讀取同步資料中…</div>}

      {courses && (
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-gray-900">爬到 {courses.length} 門課程（勾選要建立的）</h3>
            <button
              onClick={handleClearDiscover}
              disabled={clearing}
              className="text-sm text-gray-500 hover:text-red-600 border border-gray-300 rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
              title="只清掉這份爬取預覽，不會刪除任何已建立的課程或學生"
            >
              {clearing ? '清除中…' : '🗑 清除爬取預覽'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">建立</th>
                  <th className="px-3 py-2 text-left">課名</th>
                  <th className="px-3 py-2 text-left">課號</th>
                  <th className="px-3 py-2 text-left">學期</th>
                  <th className="px-3 py-2 text-left">你的身分</th>
                  <th className="px-3 py-2 text-left">名單</th>
                  <th className="px-3 py-2 text-left">A/B 分班</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {courses.map((c, i) => {
                  const valid = (c.students || []).filter((s) => !s.withdrawn).length;
                  return (
                    <tr key={i} className={c.error ? 'opacity-50' : ''}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected.has(i)} disabled={!c.cosId}
                          onChange={() => toggle(i)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                      </td>
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2 font-mono">{c.cosId || '—'}</td>
                      <td className="px-3 py-2">{c.year && c.semester ? `${c.year}/${c.semester}` : '—'}</td>
                      <td className="px-3 py-2">
                        {c.error ? <span className="text-red-600 text-xs">讀取失敗</span>
                          : c.isInstructor ? <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">老師</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">學生</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{c.students ? `${valid} 人` : '—'}</td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={divisions.has(i)} disabled={!selected.has(i)}
                          onChange={() => toggleDivision(i)} className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          title="此課有 A/B 兩班（目前插件抓的是預設班；分班完整支援後續加強）" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {importResult ? (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm space-y-1">
              <div className="font-medium">✅ 匯入完成</div>
              <div>新建課程 {importResult.coursesCreated} 門、更新對應 {importResult.coursesUpdated} 門。</div>
              {importResult.courses.map((r, idx) => (
                <div key={idx} className="text-gray-700">
                  {r.name}：新增 {r.created} 人、略過 {r.skipped}、差異待檢視 {r.conflicts}
                </div>
              ))}
              {importResult.errors.length > 0 && (
                <div className="text-red-700 whitespace-pre-line mt-1">{importResult.errors.join('\n')}</div>
              )}
              <div className="pt-1">
                匯入的學生可直接以學號登入。到
                <Link href="/" className="text-blue-600 hover:underline mx-1">課程頁</Link>查看。
              </div>
            </div>
          ) : (
            <button onClick={handleImport} disabled={importing || selected.size === 0}
              className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
              {importing ? '匯入中…' : `✅ 建立勾選的 ${selected.size} 門課程並寫入名單`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
