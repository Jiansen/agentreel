"use client";

import { useState, useCallback } from "react";
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

function SettingsLink() {
  if (process.env.NEXT_PUBLIC_VERCEL === "1") return null;
  return (
    <a
      href="/settings"
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium
        text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]
        transition-colors shrink-0"
      title="Settings"
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="2.5" />
        <path d="M6.8 1.5h2.4l.4 1.8.8.4 1.7-.7 1.7 1.7-.7 1.7.4.8 1.8.4v2.4l-1.8.4-.4.8.7 1.7-1.7 1.7-1.7-.7-.8.4-.4 1.8H6.8l-.4-1.8-.8-.4-1.7.7-1.7-1.7.7-1.7-.4-.8-1.8-.4V6.8l1.8-.4.4-.8-.7-1.7L3.9 2.2l1.7.7.8-.4z" />
      </svg>
    </a>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "AgentReel Live", url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail on HTTP; use textarea fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  return (
    <button
      onClick={handleShare}
      className="relative flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium
        text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]
        transition-colors shrink-0"
      title="Share this live session"
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8V14H12V8" />
        <polyline points="8,2 12,6" />
        <polyline points="8,2 4,6" />
        <line x1="8" y1="2" x2="8" y2="10" />
      </svg>
      {copied ? "Copied!" : "Share"}
    </button>
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
        <ShareButton />
        <SettingsLink />
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
      <ShareButton />
      <SettingsLink />
    </div>
  );
}
