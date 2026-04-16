'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type DrawGroup = { id: string; name: string };

type Phase = 'idle' | 'rolling' | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
  groups: DrawGroup[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TOTAL_MS = 3000;
const FAST_DELAY = 80;
const SLOW_DELAY = 400;
const STAGGER_MS = 100;

export default function PresentationDrawModal({ open, onClose, groups }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [displayOrder, setDisplayOrder] = useState<DrawGroup[]>(groups);
  const [finalOrder, setFinalOrder] = useState<DrawGroup[] | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);

  const rollingTimeoutRef = useRef<number | null>(null);
  const staggerTimeoutsRef = useRef<number[]>([]);

  const cleanupTimers = useCallback(() => {
    if (rollingTimeoutRef.current !== null) {
      clearTimeout(rollingTimeoutRef.current);
      rollingTimeoutRef.current = null;
    }
    staggerTimeoutsRef.current.forEach((id) => clearTimeout(id));
    staggerTimeoutsRef.current = [];
  }, []);

  // 每次 Modal 開啟時,同步最新 groups 並回到 idle
  useEffect(() => {
    if (open) {
      cleanupTimers();
      setPhase('idle');
      setDisplayOrder(groups);
      setFinalOrder(null);
      setRevealedCount(0);
    }
  }, [open, groups, cleanupTimers]);

  // 卸載時清理 timers
  useEffect(() => {
    return () => {
      cleanupTimers();
    };
  }, [cleanupTimers]);

  // ESC 關閉(僅 idle / done 允許,滾動中不中斷)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'rolling') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, phase]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const startRolling = useCallback(() => {
    if (groups.length === 0) return;

    cleanupTimers();
    setPhase('rolling');
    setFinalOrder(null);
    setRevealedCount(0);

    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;

      if (elapsed >= TOTAL_MS) {
        const final = shuffle(groups);
        setDisplayOrder(final);
        setFinalOrder(final);
        setPhase('done');

        // Stagger 揭曉每張卡片的順序徽章
        groups.forEach((_, i) => {
          const id = window.setTimeout(() => {
            setRevealedCount((c) => c + 1);
          }, i * STAGGER_MS);
          staggerTimeoutsRef.current.push(id);
        });
        return;
      }

      const p = elapsed / TOTAL_MS; // 0 → 1
      const ease = p * p; // 二次方緩動,前期快後期慢
      const delay = FAST_DELAY + (SLOW_DELAY - FAST_DELAY) * ease;

      setDisplayOrder(shuffle(groups));
      rollingTimeoutRef.current = window.setTimeout(tick, delay);
    };

    tick();
  }, [groups, cleanupTimers]);

  const handleBackdropClick = () => {
    if (phase !== 'rolling') {
      onClose();
    }
  };

  const handleCloseButton = () => {
    cleanupTimers();
    onClose();
  };

  if (!open) return null;

  const canClose = phase !== 'rolling';
  const isEmpty = groups.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="draw-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2
            id="draw-modal-title"
            className="text-lg font-semibold text-gray-900"
          >
            🎲 隨機抽籤 - 報告順序
          </h2>
          <button
            type="button"
            onClick={handleCloseButton}
            disabled={!canClose}
            className="text-gray-400 hover:text-gray-600 disabled:text-gray-200 disabled:cursor-not-allowed text-2xl leading-none"
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {isEmpty ? (
            <div className="text-center text-gray-500 py-8">
              尚無分組可抽籤,請先新增分組
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                {phase === 'idle' && (
                  <>共 {groups.length} 組,點擊下方按鈕開始抽籤</>
                )}
                {phase === 'rolling' && (
                  <span className="text-purple-700 font-medium animate-pulse">
                    🎰 抽籤中...
                  </span>
                )}
                {phase === 'done' && (
                  <span className="text-green-700 font-medium">
                    ✨ 抽籤完成!以下為報告順序
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                {displayOrder.map((group, index) => {
                  const isRevealed = phase === 'done' && index < revealedCount;
                  return (
                    <div
                      key={`${group.id}-${index}`}
                      className={`relative bg-white rounded-lg shadow-sm border p-4 min-h-[80px] flex items-center justify-center text-center ${
                        phase === 'rolling' ? 'opacity-90' : ''
                      }`}
                    >
                      {/* 順序徽章 */}
                      {phase === 'done' && (
                        <div
                          className={`absolute -top-3 -left-3 w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-lg flex items-center justify-center shadow-md transition-all duration-300 ${
                            isRevealed
                              ? 'scale-100 opacity-100'
                              : 'scale-0 opacity-0'
                          }`}
                        >
                          {index + 1}
                        </div>
                      )}

                      <div
                        className={`font-medium text-gray-900 break-all ${
                          phase === 'rolling' ? 'blur-[0.5px]' : ''
                        }`}
                      >
                        {group.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          {phase === 'idle' && (
            <>
              <button
                type="button"
                onClick={handleCloseButton}
                className="bg-white border text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                關閉
              </button>
              <button
                type="button"
                onClick={startRolling}
                disabled={isEmpty}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                🎲 開始抽籤
              </button>
            </>
          )}
          {phase === 'rolling' && (
            <button
              type="button"
              disabled
              className="bg-gray-400 text-white px-4 py-2 rounded-lg cursor-not-allowed"
            >
              抽籤中...
            </button>
          )}
          {phase === 'done' && (
            <>
              <button
                type="button"
                onClick={handleCloseButton}
                className="bg-white border text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                關閉
              </button>
              <button
                type="button"
                onClick={startRolling}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                🔄 再抽一次
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
