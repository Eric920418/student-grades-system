'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  url: string;
  title?: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  onNumPagesChange: (n: number) => void;
  containerWidth: number;
  containerHeight: number;
  onExitFullscreen: () => void;
}

export default function PdfPresenter({
  url,
  title,
  currentPage,
  onPageChange,
  onNumPagesChange,
  containerWidth,
  containerHeight,
  onExitFullscreen,
}: Props) {
  const [numPages, setNumPages] = useState(0);

  const pageWidth = containerWidth && containerHeight
    ? Math.min(containerWidth * 0.95, containerHeight * 0.92 * (16 / 9))
    : undefined;
  const pageHeight = containerWidth && containerHeight
    ? containerHeight * 0.92
    : undefined;

  return (
    <>
      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative cursor-pointer select-none"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          if (clickX < rect.width / 2) {
            onPageChange(Math.max(currentPage - 1, 1));
          } else {
            onPageChange(Math.min(currentPage + 1, numPages));
          }
        }}
      >
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n);
            onNumPagesChange(n);
          }}
          loading={
            <div className="text-white text-lg">載入 PDF 中...</div>
          }
          error={
            <div className="text-red-400 text-lg">PDF 載入失敗</div>
          }
        >
          <Page
            pageNumber={currentPage}
            width={pageWidth}
            height={pageHeight}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 opacity-0 hover:opacity-100 transition-opacity duration-300">
        <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-t from-black/80 to-transparent">
          <span className="text-white/80 text-sm">
            {title || '期中報告'}
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPageChange(Math.max(currentPage - 1, 1));
              }}
              disabled={currentPage <= 1}
              className="text-white/90 hover:text-white disabled:text-white/30 text-lg px-2"
            >
              ◀
            </button>
            <span className="text-white/90 text-sm font-mono tabular-nums">
              {currentPage} / {numPages || '...'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPageChange(Math.min(currentPage + 1, numPages));
              }}
              disabled={currentPage >= numPages}
              className="text-white/90 hover:text-white disabled:text-white/30 text-lg px-2"
            >
              ▶
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExitFullscreen();
              }}
              className="bg-white/20 text-white px-3 py-1 rounded hover:bg-white/30 text-sm ml-4"
            >
              ESC 退出
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
