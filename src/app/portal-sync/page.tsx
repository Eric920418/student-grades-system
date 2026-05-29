'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  buildScrapeScript,
  DEFAULT_SCRAPE_CONFIG,
  IMPORT_JSON_VERSION,
  type ScrapeSelectorConfig,
  type ImportRow,
} from '@/lib/portalSync';

interface FieldDiff {
  field: 'name' | 'class' | 'email';
  dbValue: string | null;
  portalValue: string;
}
interface Conflict {
  row: ImportRow;
  diffs: FieldDiff[];
}
interface PreviewResult {
  toCreate: ImportRow[];
  identical: ImportRow[];
  conflicts: Conflict[];
  invalid: Array<{ row: ImportRow; reason: string }>;
}
interface CommitResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface GradeItem {
  id: string;
  name: string;
}
interface UploadJob {
  id: string;
  kind: 'grades' | 'roster';
  gradeItemName: string | null;
  status: 'pending' | 'running' | 'success' | 'failed';
  dryRun: boolean;
  filledCount: number | null;
  totalCount: number | null;
  message: string | null;
  screenshotUrl: string | null;
  createdAt: string;
}

const FIELD_LABEL: Record<string, string> = { name: '姓名', class: '班級', email: 'Email' };

const JOB_STATUS_LABEL: Record<string, string> = {
  pending: '排隊中',
  running: '執行中',
  success: '完成',
  failed: '失敗',
};
const JOB_STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export default function PortalSyncPage() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');

  const [courseName, setCourseName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 抓取腳本的 selector 設定（可調、存 localStorage）
  const [scrapeConfig, setScrapeConfig] = useState<ScrapeSelectorConfig>(DEFAULT_SCRAPE_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  // 匯入流程
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [overwriteSet, setOverwriteSet] = useState<Set<string>>(new Set());
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  // 自動上傳成績到 portal
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);
  const [selectedGradeItemId, setSelectedGradeItemId] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [fillZero, setFillZero] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  // portal 課程對應 + 名單同步
  const [portalCosId, setPortalCosId] = useState('');
  const [portalYear, setPortalYear] = useState('');
  const [portalSemester, setPortalSemester] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [syncingRoster, setSyncingRoster] = useState(false);

  const storageKey = courseId ? `portalScrapeConfig:${courseId}` : 'portalScrapeConfig';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        setScrapeConfig(JSON.parse(saved));
      } catch {
        /* 壞掉的設定就用預設 */
      }
    }
  }, [storageKey]);

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '獲取課程失敗');
        setCourseName(data.name || '');
        setPortalCosId(data.portalCosId || '');
        setPortalYear(data.portalYear || '');
        setPortalSemester(data.portalSemester || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : '獲取課程失敗');
      }
    })();
  }, [courseId]);

  // 載入課程的成績項目（供選擇上傳哪一項）
  useEffect(() => {
    if (!courseId) return;
    (async () => {
      try {
        const res = await fetch(`/api/grade-items?courseId=${courseId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '獲取成績項目失敗');
        setGradeItems(data);
        if (data.length > 0) setSelectedGradeItemId((prev) => prev || data[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : '獲取成績項目失敗');
      }
    })();
  }, [courseId]);

  // 輪詢最近的上傳任務狀態（每 4 秒）
  useEffect(() => {
    if (!courseId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/portal-sync/jobs?courseId=${courseId}`);
        const data = await res.json();
        if (active && res.ok) setJobs(data);
      } catch {
        /* 輪詢失敗靜默重試 */
      }
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [courseId]);

  const handleDispatch = async () => {
    setError(null);
    if (!courseId || !selectedGradeItemId) {
      setError('請先選擇成績項目');
      return;
    }
    try {
      setDispatching(true);
      const res = await fetch('/api/portal-sync/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          gradeItemId: selectedGradeItemId,
          dryRun,
          fillUnrecordedZero: fillZero,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? `${data.error}：${data.details}` : data.error);
      // 立即刷新任務列表
      const jobsRes = await fetch(`/api/portal-sync/jobs?courseId=${courseId}`);
      if (jobsRes.ok) setJobs(await jobsRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : '觸發上傳失敗');
    } finally {
      setDispatching(false);
    }
  };

  const handleSaveConfig = async () => {
    setError(null);
    setConfigSaved(false);
    try {
      setSavingConfig(true);
      const res = await fetch('/api/portal-sync/course-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, portalCosId, portalYear, portalSemester }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? `${data.error}：${data.details}` : data.error);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存 portal 對應失敗');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSyncRoster = async () => {
    setError(null);
    try {
      setSyncingRoster(true);
      const res = await fetch('/api/portal-sync/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, mode: 'roster' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? `${data.error}：${data.details}` : data.error);
      const jobsRes = await fetch(`/api/portal-sync/jobs?courseId=${courseId}`);
      if (jobsRes.ok) setJobs(await jobsRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : '觸發名單同步失敗');
    } finally {
      setSyncingRoster(false);
    }
  };

  const persistConfig = (next: ScrapeSelectorConfig) => {
    setScrapeConfig(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
  };

  const handleCopyScrapeScript = async () => {
    try {
      await navigator.clipboard.writeText(buildScrapeScript(scrapeConfig));
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      alert(`複製失敗：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePreview = async () => {
    setError(null);
    setPreview(null);
    setCommitResult(null);
    setOverwriteSet(new Set());

    if (!courseId) {
      setError('網址缺少 courseId，請從課程頁進入');
      return;
    }

    let payload: { _v?: number; kind?: string; rows?: ImportRow[] };
    try {
      payload = JSON.parse(jsonText);
    } catch (err) {
      setError(`JSON 解析失敗：${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (payload._v !== IMPORT_JSON_VERSION || payload.kind !== 'students' || !Array.isArray(payload.rows)) {
      setError('貼上的內容格式不符（應為由「撈取名單腳本」產生的學生名單 JSON）');
      return;
    }

    try {
      setPreviewLoading(true);
      const res = await fetch('/api/portal-sync/students/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, rows: payload.rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? `${data.error}：${data.details}` : data.error);
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '預覽失敗');
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleOverwrite = (studentId: string) => {
    setOverwriteSet((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleCommit = async () => {
    if (!courseId || !preview) return;
    setError(null);

    const update = preview.conflicts
      .filter((c) => overwriteSet.has(c.row.studentId))
      .map((c) => {
        const fields: Record<string, string> = {};
        for (const d of c.diffs) fields[d.field] = d.portalValue;
        return { studentId: c.row.studentId, fields };
      });

    try {
      setCommitting(true);
      const res = await fetch('/api/portal-sync/students/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, create: preview.toCreate, update }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details ? `${data.error}：${data.details}` : data.error);
      setCommitResult(data);
      setPreview(null);
      setJsonText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入失敗');
    } finally {
      setCommitting(false);
    }
  };

  if (!courseId) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        網址缺少 courseId，請從<Link href="/" className="underline ml-1">首頁</Link>選擇課程後進入。
      </div>
    );
  }

  const gradeJobs = jobs.filter((j) => j.kind !== 'roster');
  const rosterJobs = jobs.filter((j) => j.kind === 'roster');
  const portalConfigComplete = !!(portalCosId && portalYear && portalSemester);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          校務系統同步
          {courseName && <span className="text-lg text-gray-600 ml-2">- {courseName}</span>}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          <strong>自動上傳成績</strong>到校務系統(portalx)、或從 portalx <strong>撈學生名單</strong>匯入本系統。
          也可到
          <Link href={`/grade-items?courseId=${courseId}`} className="text-blue-600 hover:underline mx-1">成績項目</Link>
          頁取得手動貼上的 Console 填分腳本（備援）。
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg whitespace-pre-line">
          {error}
        </div>
      )}

      {/* 從 portal 自動同步學生名單（GitHub Actions worker） */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4 border-2 border-emerald-100">
        <h3 className="text-lg font-semibold text-gray-900">🧑‍🎓 從 portal 同步學生名單</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          自動登入 portalx、抓取此課程的學生名單寫入系統（<strong>只新增、不覆蓋</strong>既有資料；差異列會標示待你檢視；停修自動跳過）。
          匯入的學生會同時建立登入帳號，可直接以學號登入——學生不需自助註冊。
        </p>

        {/* portal 課程對應 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs text-gray-600">portal 課號 (cosid)</span>
            <input
              type="text"
              value={portalCosId}
              onChange={(e) => setPortalCosId(e.target.value)}
              placeholder="如 IC411"
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">學年 (y)</span>
            <input
              type="text"
              value={portalYear}
              onChange={(e) => setPortalYear(e.target.value)}
              placeholder="如 114"
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">學期 (s)</span>
            <input
              type="text"
              value={portalSemester}
              onChange={(e) => setPortalSemester(e.target.value)}
              placeholder="如 2"
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveConfig}
            disabled={savingConfig}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:bg-gray-300 transition-colors"
          >
            {savingConfig ? '儲存中…' : configSaved ? '已儲存 ✓' : '儲存對應'}
          </button>
          <button
            onClick={handleSyncRoster}
            disabled={syncingRoster || !portalConfigComplete}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            title={portalConfigComplete ? '' : '請先填寫並儲存 portal 課號/學年/學期'}
          >
            {syncingRoster ? '觸發中…' : '🔄 同步名單'}
          </button>
        </div>

        {rosterJobs.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">最近的名單同步</div>
            {rosterJobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${JOB_STATUS_COLOR[job.status]}`}>
                    {JOB_STATUS_LABEL[job.status] || job.status}
                  </span>
                  {job.totalCount != null && (
                    <span className="text-xs text-gray-500">抓到 {job.totalCount} 筆</span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(job.createdAt).toLocaleString('zh-TW')}
                  </span>
                </div>
                {job.message && (
                  <div className={`text-xs whitespace-pre-line ${job.status === 'failed' ? 'text-red-600' : 'text-gray-600'}`}>
                    {job.message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 自動上傳成績到 portal（GitHub Actions worker） */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4 border-2 border-blue-100">
        <h3 className="text-lg font-semibold text-gray-900">🤖 自動上傳成績到 portal</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          按下後會在雲端開一台臨時機器，自動登入 portalx 並逐格填分（用後即焚）。
          建議<strong>先用「乾跑」</strong>——只填不送出、回傳截圖給你核對無誤後，再改「正式送出」。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-gray-600">成績項目</span>
            <select
              value={selectedGradeItemId}
              onChange={(e) => setSelectedGradeItemId(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {gradeItems.length === 0 && <option value="">（此課程尚無成績項目）</option>}
              {gradeItems.map((gi) => (
                <option key={gi.id} value={gi.id}>{gi.name}</option>
              ))}
            </select>
          </label>

          <div className="space-y-2 sm:pt-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              乾跑（只填不送出，回傳截圖核對）
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={fillZero}
                onChange={(e) => setFillZero(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              未登記成績的學生也填 0 分
            </label>
          </div>
        </div>

        {!dryRun && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3 py-2">
            ⚠️ 已關閉乾跑：這次會<strong>實際送出</strong>到 portalx 正式成績。請確認已先乾跑核對過。
          </div>
        )}

        <button
          onClick={handleDispatch}
          disabled={dispatching || !selectedGradeItemId}
          className={`w-full text-white px-6 py-3 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors ${
            dryRun ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {dispatching ? '觸發中…' : dryRun ? '🧪 乾跑（只填不送出）' : '🚀 正式送出到 portal'}
        </button>

        {/* 任務狀態列表 */}
        {gradeJobs.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">最近的上傳任務</div>
            {gradeJobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${JOB_STATUS_COLOR[job.status]}`}>
                    {JOB_STATUS_LABEL[job.status] || job.status}
                  </span>
                  <span className="font-medium">{job.gradeItemName}</span>
                  <span className="text-xs text-gray-500">{job.dryRun ? '乾跑' : '正式送出'}</span>
                  {job.totalCount != null && (
                    <span className="text-xs text-gray-500">
                      {job.filledCount != null ? `已填 ${job.filledCount}/` : ''}{job.totalCount} 筆
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(job.createdAt).toLocaleString('zh-TW')}
                  </span>
                </div>
                {job.message && (
                  <div className={`text-xs whitespace-pre-line ${job.status === 'failed' ? 'text-red-600' : 'text-gray-600'}`}>
                    {job.message}
                  </div>
                )}
                {job.screenshotUrl && (
                  <a href={job.screenshotUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-block">
                    🖼️ 查看截圖
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 步驟一：撈取名單腳本 */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">① 在 portalx 撈取名單</h3>
        <div className="text-sm text-gray-700 leading-relaxed">
          登入校務系統 → 開啟學生名單頁 → 按 <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">F12</kbd> →
          <strong> Console</strong> → 貼上下方腳本 → <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">Enter</kbd>。
          腳本會抓取名單並<strong>複製成 JSON 到剪貼簿</strong>，再回來貼到步驟二。
        </div>

        <button
          onClick={handleCopyScrapeScript}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          {copyStatus === 'copied' ? '已複製 ✓' : '📋 複製撈取名單腳本'}
        </button>

        <button
          onClick={() => setShowConfig((v) => !v)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {showConfig ? '▼' : '▶'} 進階：調整欄位 selector（拿到 portalx 實際 HTML 後設定）
        </button>
        {showConfig && (
          <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <ConfigField
              label="列 selector (rowSelector)"
              value={scrapeConfig.rowSelector}
              onChange={(v) => persistConfig({ ...scrapeConfig, rowSelector: v })}
            />
            {(['studentId', 'name', 'class', 'email'] as const).map((key) => (
              <ConfigField
                key={key}
                label={`${key === 'studentId' ? '學號' : FIELD_LABEL[key]} 欄 selector`}
                value={scrapeConfig.columnMap[key] || ''}
                onChange={(v) =>
                  persistConfig({ ...scrapeConfig, columnMap: { ...scrapeConfig.columnMap, [key]: v } })
                }
              />
            ))}
            <button
              onClick={() => persistConfig(DEFAULT_SCRAPE_CONFIG)}
              className="text-sm text-blue-600 hover:underline"
            >
              還原預設
            </button>
          </div>
        )}
      </div>

      {/* 步驟二：貼上 JSON 並預覽 */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">② 貼上名單 JSON 並預覽</h3>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder="在此貼上步驟一複製的 JSON…"
          rows={6}
          className="w-full border border-gray-300 rounded-lg p-3 font-mono text-xs focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handlePreview}
          disabled={!jsonText.trim() || previewLoading}
          className="w-full bg-gray-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {previewLoading ? '解析中…' : '🔍 解析預覽（不會寫入）'}
        </button>
      </div>

      {/* 步驟三：預覽結果 + 確認匯入 */}
      {preview && (
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">③ 確認匯入</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat color="green" label="將新增" value={preview.toCreate.length} />
            <Stat color="gray" label="完全相同(略過)" value={preview.identical.length} />
            <Stat color="orange" label="有差異(衝突)" value={preview.conflicts.length} />
            <Stat color="red" label="無效列" value={preview.invalid.length} />
          </div>

          {preview.conflicts.length > 0 && (
            <div className="border border-orange-200 rounded-lg overflow-hidden">
              <div className="bg-orange-50 px-4 py-2 text-sm text-orange-800">
                以下學生已存在且資料有差異。<strong>預設不覆蓋</strong>；勾選後才會以 portal 值覆蓋。
              </div>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">覆蓋</th>
                    <th className="px-3 py-2 text-left">學號</th>
                    <th className="px-3 py-2 text-left">差異</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {preview.conflicts.map((c) => (
                    <tr key={c.row.studentId}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={overwriteSet.has(c.row.studentId)}
                          onChange={() => toggleOverwrite(c.row.studentId)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono">{c.row.studentId}</td>
                      <td className="px-3 py-2">
                        {c.diffs.map((d) => (
                          <div key={d.field} className="text-xs">
                            <span className="text-gray-500">{FIELD_LABEL[d.field]}：</span>
                            <span className="text-red-600 line-through">{d.dbValue || '(空)'}</span>
                            <span className="mx-1">→</span>
                            <span className="text-green-700">{d.portalValue}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.invalid.length > 0 && (
            <div className="text-xs text-red-600">
              {preview.invalid.map((iv, i) => (
                <div key={i}>{iv.row.studentId || '(空學號)'}：{iv.reason}</div>
              ))}
            </div>
          )}

          <button
            onClick={handleCommit}
            disabled={committing || (preview.toCreate.length === 0 && overwriteSet.size === 0)}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {committing
              ? '寫入中…'
              : `✅ 確認匯入（新增 ${preview.toCreate.length} 筆，覆蓋 ${overwriteSet.size} 筆）`}
          </button>
        </div>
      )}

      {commitResult && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm space-y-1">
          <div className="font-medium">✅ 匯入完成</div>
          <div>新增 {commitResult.created} 筆、更新 {commitResult.updated} 筆、略過 {commitResult.skipped} 筆。</div>
          {commitResult.errors.length > 0 && (
            <div className="text-red-700 whitespace-pre-line mt-2">
              {commitResult.errors.join('\n')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConfigField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-600">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-gray-300 rounded px-2 py-1 font-mono text-xs focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function Stat({ color, label, value }: { color: string; label: string; value: number }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-900',
    gray: 'bg-gray-50 text-gray-900',
    orange: 'bg-orange-50 text-orange-900',
    red: 'bg-red-50 text-red-900',
  };
  return (
    <div className={`rounded-lg p-3 ${colors[color]}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
