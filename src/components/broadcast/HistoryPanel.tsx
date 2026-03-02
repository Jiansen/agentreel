"use client";

import { useState, useEffect, useCallback } from "react";

interface SessionEntry {
  file: string;
  task: string;
  startedAt: string;
  status: "done" | "running";
  events: number;
  summary: string;
}

interface HistoryPanelProps {
  relayUrl: string;
  refreshMs?: number;
}

function timeAgo(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return `${Math.floor(ms / 86_400_000)}d ago`;
  } catch {
    return "";
  }
}

export default function HistoryPanel({ relayUrl, refreshMs = 30_000 }: HistoryPanelProps) {
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const base = relayUrl.replace(/\/api\/stream$/, "").replace(/\/$/, "");
      const res = await fetch(`${base}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      // network error — keep showing stale data
    } finally {
      setLoading(false);
    }
  }, [relayUrl]);

  useEffect(() => {
    fetchHistory();
    const timer = setInterval(fetchHistory, refreshMs);
    return () => clearInterval(timer);
  }, [fetchHistory, refreshMs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] text-[var(--text-muted)] animate-pulse">
        Loading history...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] text-[var(--text-muted)]">
        No sessions yet
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-1.5 space-y-1">
      {sessions.map((s, i) => {
        const isRunning = s.status === "running";
        return (
          <div
            key={s.file}
            className={`rounded-md p-1.5 border-l-[3px] ${
              isRunning
                ? "bg-[#1a1a3a] border-l-[var(--accent-green)]"
                : "bg-[var(--bg-tertiary)] border-l-[var(--accent-cyan)]"
            } ${i === 0 && isRunning ? "ring-1 ring-[var(--accent-green)]/30" : ""}`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className={`inline-flex items-center gap-0.5 text-[7px] font-bold px-1 py-px rounded uppercase tracking-wider ${
                  isRunning
                    ? "bg-[#064e3b] text-[var(--accent-green)]"
                    : "bg-[#1e293b] text-[var(--accent-cyan)]"
                }`}
              >
                {isRunning ? "▶ Live" : "✓ Done"}
              </span>
              <span className="text-[7px] text-[var(--text-muted)] ml-auto">
                {timeAgo(s.startedAt)}
              </span>
            </div>

            <div className="text-[9px] text-[var(--text-primary)] leading-snug line-clamp-2 font-medium">
              {s.task}
            </div>

            {s.summary && (
              <div className="text-[8px] text-[var(--text-muted)] leading-snug mt-0.5 line-clamp-2 italic">
                {s.summary}
              </div>
            )}

            <div className="text-[7px] text-[var(--text-muted)] mt-0.5 opacity-60">
              {s.events} events
            </div>
          </div>
        );
      })}
    </div>
  );
}
