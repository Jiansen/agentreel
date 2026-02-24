"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TimelineEvent } from "@/types/timeline";

interface PlaybackControlsProps {
  events: TimelineEvent[];
  activeIndex: number;
  onSeek: (index: number) => void;
}

export default function PlaybackControls({
  events,
  activeIndex,
  onSeek,
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

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/80 transition-colors text-white text-sm"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

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

      {/* Event counter */}
      <span className="text-xs text-[var(--text-muted)] font-mono tabular-nums shrink-0">
        {activeIndex + 1} / {events.length}
      </span>

      {/* Speed control */}
      <button
        onClick={() => setSpeed((s) => (s >= 4 ? 0.5 : s * 2))}
        className="text-xs px-2 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors tabular-nums"
        title="Playback speed"
      >
        {speed}×
      </button>
    </div>
  );
}
