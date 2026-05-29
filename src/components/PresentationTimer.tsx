'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'running' | 'paused' | 'finished';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESETS_MIN = [1, 3, 5, 10];
const ALARM_BEEPS = 4;
const BEEP_DURATION = 0.35; // 秒
const BEEP_GAP = 0.2; // 秒

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PresentationTimer({ open, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  // 用結束時間戳記反推剩餘時間,避免長時間累加漂移
  const endAtRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 確保 AudioContext 已建立並啟用(必須在使用者手勢中呼叫)
  const ensureAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctx) {
          setAudioError('此瀏覽器不支援 Web Audio API,將以無聲倒數');
          return;
        }
        audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        void audioCtxRef.current.resume();
      }
      setAudioError(null);
    } catch (err) {
      setAudioError(
        `無法初始化鬧鈴音效:${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, []);

  // 時間到時排程數聲 beep,結束後自動停止
  const playAlarm = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      for (let i = 0; i < ALARM_BEEPS; i++) {
        const t0 = ctx.currentTime + i * (BEEP_DURATION + BEEP_GAP);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 880;
        // 包絡:快速淡入淡出避免爆音
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + BEEP_DURATION);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + BEEP_DURATION);
      }
    } catch (err) {
      setAudioError(
        `鬧鈴播放失敗:${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, []);

  const startTick = useCallback(() => {
    clearTick();
    intervalRef.current = window.setInterval(() => {
      const left = endAtRef.current - performance.now();
      if (left <= 0) {
        setRemainingMs(0);
        clearTick();
        setPhase('finished');
        playAlarm();
      } else {
        setRemainingMs(left);
      }
    }, 200);
  }, [clearTick, playAlarm]);

  const handleStart = useCallback(() => {
    const totalMs = (minutes * 60 + seconds) * 1000;
    if (totalMs <= 0) return;
    ensureAudio();
    endAtRef.current = performance.now() + totalMs;
    setRemainingMs(totalMs);
    setPhase('running');
    startTick();
  }, [minutes, seconds, ensureAudio, startTick]);

  const handlePause = useCallback(() => {
    clearTick();
    setRemainingMs(endAtRef.current - performance.now());
    setPhase('paused');
  }, [clearTick]);

  const handleResume = useCallback(() => {
    ensureAudio();
    endAtRef.current = performance.now() + remainingMs;
    setPhase('running');
    startTick();
  }, [remainingMs, ensureAudio, startTick]);

  const handleReset = useCallback(() => {
    clearTick();
    setRemainingMs(0);
    setPhase('idle');
  }, [clearTick]);

  const handleClose = useCallback(() => {
    clearTick();
    onClose();
  }, [clearTick, onClose]);

  // 卸載時清理計時器
  useEffect(() => {
    return () => {
      clearTick();
    };
  }, [clearTick]);

  if (!open) return null;

  const isFinished = phase === 'finished';

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-72 rounded-xl shadow-2xl border ${
        isFinished
          ? 'bg-red-50 border-red-300 animate-pulse'
          : 'bg-white border-gray-200'
      }`}
      role="dialog"
      aria-label="報告計時器"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">⏱️ 報告計時</span>
        <button
          type="button"
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="關閉計時器"
        >
          ×
        </button>
      </div>

      <div className="p-4">
        {phase === 'idle' ? (
          <>
            {/* 時間設定 */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(Math.max(0, Math.min(999, Number(e.target.value) || 0)))
                  }
                  className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500 mt-1">分</span>
              </div>
              <span className="text-2xl font-bold text-gray-400">:</span>
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={seconds}
                  onChange={(e) =>
                    setSeconds(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
                  }
                  className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500 mt-1">秒</span>
              </div>
            </div>

            {/* 快速預設 */}
            <div className="flex justify-center gap-2 mb-4">
              {PRESETS_MIN.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMinutes(m);
                    setSeconds(0);
                  }}
                  className="px-2.5 py-1 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {m} 分
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={minutes * 60 + seconds <= 0}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              ▶ 開始
            </button>
          </>
        ) : (
          <>
            {/* 倒數顯示 */}
            <div
              className={`text-center text-5xl font-mono font-bold tabular-nums mb-4 ${
                isFinished ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {isFinished ? formatTime(0) : formatTime(remainingMs)}
            </div>

            {isFinished ? (
              <div className="space-y-2">
                <div className="text-center text-red-600 font-semibold mb-2">
                  ⏰ 時間到！
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    ↺ 重新計時
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    關閉
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {phase === 'running' ? (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="flex-1 bg-amber-500 text-white py-2 rounded-lg hover:bg-amber-600 transition-colors font-medium"
                  >
                    ⏸ 暫停
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleResume}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    ▶ 繼續
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  ↺ 重設
                </button>
              </div>
            )}
          </>
        )}

        {audioError && (
          <p className="mt-3 text-xs text-red-600 break-words">{audioError}</p>
        )}
      </div>
    </div>
  );
}
