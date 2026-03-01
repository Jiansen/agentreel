"use client";

interface MissionBarProps {
  missionName: string;
  elapsedMs: number;
  isLive: boolean;
  compact?: boolean;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function MissionBar({ missionName, elapsedMs, isLive, compact }: MissionBarProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        {isLive && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-red)] animate-pulse shrink-0" />}
        <span className="text-[10px] font-bold truncate">{missionName}</span>
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
      <span className="text-[10px] text-[var(--text-muted)] ml-auto shrink-0">{formatElapsed(elapsedMs)}</span>
    </div>
  );
}
