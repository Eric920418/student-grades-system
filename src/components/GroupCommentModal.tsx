'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (comment: string) => Promise<void> | void;
  groupName: string;
  gradeItemName: string;
  initialComment: string;
}

export default function GroupCommentModal({
  open,
  onClose,
  onSave,
  groupName,
  gradeItemName,
  initialComment,
}: Props) {
  const [draft, setDraft] = useState(initialComment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 每次打開時,重置 draft 和 error
  useEffect(() => {
    if (open) {
      setDraft(initialComment);
      setError(null);
      // 自動 focus 到 textarea
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, initialComment]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC 關閉(儲存中不允許)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, saving]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter 快速儲存
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSave();
    }
  };

  if (!open) return null;

  const isDirty = draft !== initialComment;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !saving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comment-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2
              id="comment-modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              💬 撰寫評語
            </h2>
            <div className="text-sm text-gray-500 mt-1">
              {groupName} · {gradeItemName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 disabled:text-gray-200 text-2xl leading-none"
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm whitespace-pre-wrap break-words">
              {error}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入給這一組的評語...（Cmd/Ctrl + Enter 快速儲存）"
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[160px]"
          />
          <div className="mt-2 text-xs text-gray-500 flex justify-between">
            <span>{draft.length} 字</span>
            <span>留空送出即視為刪除評語</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="bg-white border text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
