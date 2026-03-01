"use client";

import type { ActivityStatus } from "@/types/broadcast";

interface MissionBarProps {
  missionName: string;
  elapsedMs: number;
  isLive: boolean;
  compact?: boolean;
  activityStatus?: ActivityStatus;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const ACTIVITY_LABELS: Record<ActivityStatus, { text: string; color: string }> = {
  thinking:  { text: "Thinking",  color: "text-[var(--accent-purple)]" },
  browsing:  { text: "Browsing",  color: "text-[var(--accent-blue)]" },
  analyzing: { text: "Analyzing", color: "text-[var(--accent-green)]" },
  writing:   { text: "Writing",   color: "text-[var(--accent-cyan)]" },
  idle:      { text: "Waiting",   color: "text-[var(--text-muted)]" },
  completed: { text: "Done",      color: "text-[var(--accent-green)]" },
};

function ActivityIndicator({ status }: { status: ActivityStatus }) {
  const label = ACTIVITY_LABELS[status] ?? ACTIVITY_LABELS.idle;
  const isActive = status !== "idle" && status !== "completed";
  return (
    <span className={`text-[9px] font-medium ${label.color} flex items-center gap-1`}>
      {isActive && (
        <span className="flex gap-[2px]">
          <span className="w-[3px] h-[3px] rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-[3px] h-[3px] rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-[3px] h-[3px] rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
        </span>
      )}
      {label.text}
    </span>
  );
}

export default function MissionBar({ missionName, elapsedMs, isLive, compact, activityStatus = "idle" }: MissionBarProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        {isLive && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-red)] animate-pulse shrink-0" />}
        <span className="text-[10px] font-bold truncate">{missionName}</span>
        <ActivityIndicator status={activityStatus} />
        <span className="text-[9px] text-[var(--text-muted)] ml-auto shrink-0">{formatElapsed(elapsedMs)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 h-[30px] bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
      {isLive && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-red)] animate-pulse shrink-0" />
          <span className="text-[9px] font-bold text-[var(--accent-red)] uppercase tracking-widest">Live</span>
        </>
      )}
      <span className="text-[11px] font-semibold truncate">{missionName}</span>
      <ActivityIndicator status={activityStatus} />
      <span className="text-[10px] text-[var(--text-muted)] ml-auto shrink-0">{formatElapsed(elapsedMs)}</span>
    </div>
  );
}
