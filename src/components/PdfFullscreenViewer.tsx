'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

const PdfPresenter = dynamic(() => import('./PdfPresenter'), { ssr: false });

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
  const [currentPage, setCurrentPage] = useState(1);
  const [numPagesForKeys, setNumPagesForKeys] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (fs) {
        setContainerSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (isFullscreen) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setCurrentPage((p) => Math.min(p + 1, numPagesForKeys || 999));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          setCurrentPage((p) => Math.max(p - 1, 1));
        } else if (e.key === 'Home') {
          e.preventDefault();
          setCurrentPage(1);
        } else if (e.key === 'End') {
          e.preventDefault();
          setCurrentPage(numPagesForKeys || 1);
        }
        return;
      }
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, isFullscreen, numPagesForKeys]);

  useEffect(() => {
    if (!open && document.fullscreenElement) {
      exitFullscreen();
    }
  }, [open, exitFullscreen]);

  useEffect(() => {
    if (open) {
      setCurrentPage(1);
      setNumPagesForKeys(0);
    }
  }, [open, url]);

  if (!open || !url) return null;

  const viewerSrc = `${url}#toolbar=1&navpanes=0&view=FitH`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-2 md:p-4">
      <div
        ref={containerRef}
        className={`bg-white shadow-xl w-full h-full flex flex-col overflow-hidden ${
          isFullscreen
            ? 'max-w-none max-h-none rounded-none bg-black'
            : 'max-w-6xl max-h-full rounded-lg'
        }`}
      >
        {/* ─── 非全螢幕：iframe 瀏覽 ─── */}
        {!isFullscreen && (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg">📄</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {title || '期中報告'}
                  </div>
                  {fileName && (
                    <div className="text-xs text-gray-500 truncate">
                      {fileName}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={enterFullscreen}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm"
                >
                  📺 投影片模式
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
            <iframe
              src={viewerSrc}
              title={title || '期中報告'}
              className="w-full flex-1 border-0 bg-gray-900"
            />
          </>
        )}

        {/* ─── 全螢幕：投影片模式 ─── */}
        {isFullscreen && (
          <PdfPresenter
            url={url}
            title={title}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onNumPagesChange={setNumPagesForKeys}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
            onExitFullscreen={exitFullscreen}
          />
        )}
      </div>
    </div>
  );
}
