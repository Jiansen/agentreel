"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { TimelineEvent } from "@/types/timeline";

export type ViewMode = "list" | "replay" | "report";

interface PlaybackControlsProps {
  events: TimelineEvent[];
  activeIndex: number;
  onSeek: (index: number) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

function formatElapsed(events: TimelineEvent[], index: number): string {
  if (events.length < 2) return "0:00";
  const start = new Date(events[0].timestamp).getTime();
  const current = new Date(
    events[Math.min(index, events.length - 1)].timestamp
  ).getTime();
  const sec = Math.max(0, Math.floor((current - start) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotal(events: TimelineEvent[]): string {
  if (events.length < 2) return "0:00";
  const start = new Date(events[0].timestamp).getTime();
  const endTime = new Date(events[events.length - 1].timestamp).getTime();
  const sec = Math.max(0, Math.floor((endTime - start) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlaybackControls({
  events,
  activeIndex,
  onSeek,
  viewMode = "list",
  onViewModeChange,
}: PlaybackControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const advancePlayback = useCallback(() => {
    onSeek(activeIndex + 1);
  }, [activeIndex, onSeek]);

  useEffect(() => {
    if (!isPlaying) return;
    if (activeIndex >= events.length - 1) {
      stopPlayback();
      return;
    }

    const current = events[activeIndex];
    const next = events[activeIndex + 1];
    let delay = 500;

    if (current && next) {
      const diff =
        new Date(next.timestamp).getTime() -
        new Date(current.timestamp).getTime();
      if (diff > 0 && diff < 30000) {
        delay = Math.max(100, Math.min(diff / speed, 3000));
      }
    }

    timerRef.current = setTimeout(advancePlayback, delay / speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, activeIndex, events, speed, stopPlayback, advancePlayback]);

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      if (activeIndex >= events.length - 1) {
        onSeek(0);
      }
      setIsPlaying(true);
    }
  };

  const progress =
    events.length > 1 ? (activeIndex / (events.length - 1)) * 100 : 0;

  const elapsed = useMemo(
    () => formatElapsed(events, activeIndex),
    [events, activeIndex]
  );
  const total = useMemo(() => formatTotal(events), [events]);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/80 transition-colors text-white text-sm shrink-0"
        title={isPlaying ? "Pause (space)" : "Play (space)"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      {/* Time elapsed */}
      <span className="text-xs text-[var(--text-muted)] font-mono tabular-nums shrink-0">
        {elapsed}
      </span>

      {/* Progress bar */}
      <div className="flex-1 relative h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden cursor-pointer group">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--accent-blue)] rounded-full transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
        <input
          type="range"
          min={0}
          max={events.length - 1}
          value={activeIndex}
          onChange={(e) => {
            stopPlayback();
            onSeek(parseInt(e.target.value));
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Time total */}
      <span className="text-xs text-[var(--text-muted)] font-mono tabular-nums shrink-0">
        {total}
      </span>

      {/* Event counter */}
      <span className="text-xs text-[var(--text-muted)] font-mono tabular-nums shrink-0 hidden sm:inline">
        {activeIndex + 1}/{events.length}
      </span>

      {/* Speed */}
      <button
        onClick={() => setSpeed((s) => (s >= 4 ? 0.5 : s * 2))}
        className="text-xs px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors tabular-nums shrink-0"
        title="Playback speed"
      >
        {speed}x
      </button>

      {/* View mode toggle */}
      {onViewModeChange && (
        <div className="flex items-center gap-1 shrink-0">
          {(["list", "replay", "report"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                viewMode === mode
                  ? mode === "report"
                    ? "bg-[var(--accent-green)]/20 text-[var(--accent-green)]"
                    : "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title={`Switch to ${mode} mode`}
            >
              {mode === "list" ? "List" : mode === "replay" ? "Replay" : "Report"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
