'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  url: string | null;
  fileName?: string | null;
  title?: string;
  onClose: () => void;
}

export default function PdfFullscreenViewer({
  open,
  url,
  fileName,
  title,
  onClose,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      }
    } catch (e) {
      console.error('進入全螢幕失敗:', e);
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.error('退出全螢幕失敗:', e);
    }
  }, []);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open && document.fullscreenElement) {
      exitFullscreen();
    }
  }, [open, exitFullscreen]);

  if (!open || !url) return null;

  const viewerSrc = `${url}#toolbar=1&navpanes=0&view=FitH`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-2 md:p-4">
      <div
        ref={containerRef}
        className={`bg-white shadow-xl w-full h-full flex flex-col overflow-hidden ${
          isFullscreen ? 'max-w-none max-h-none rounded-none' : 'max-w-6xl max-h-full rounded-lg'
        }`}
      >
        {/* 非全螢幕：固定 header */}
        {!isFullscreen && (
          <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg">📄</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {title || '期中報告'}
                </div>
                {fileName && (
                  <div className="text-xs text-gray-500 truncate">{fileName}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={enterFullscreen}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm"
                title="進入全螢幕（ESC 退出）"
              >
                📺 全螢幕
              </button>
              <a
                href={url}
                download={fileName || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-sm"
              >
                ⬇️ 下載
              </a>
              <button
                onClick={onClose}
                className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-sm"
                aria-label="關閉"
              >
                ✕ 關閉
              </button>
            </div>
          </div>
        )}

        {/* 全螢幕：浮動退出按鈕，滑鼠移到頂部才出現 */}
        {isFullscreen && (
          <div className="absolute top-0 left-0 right-0 z-10 opacity-0 hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/70 to-transparent">
              <span className="text-white/90 text-sm font-medium drop-shadow">
                {title || '期中報告'} — ESC 退出全螢幕
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={exitFullscreen}
                  className="bg-white/90 text-gray-800 px-3 py-1.5 rounded-lg hover:bg-white text-sm shadow"
                >
                  退出全螢幕
                </button>
              </div>
            </div>
          </div>
        )}

        <iframe
          src={viewerSrc}
          title={title || '期中報告'}
          className="w-full flex-1 border-0 bg-gray-900"
        />
      </div>
    </div>
  );
}
