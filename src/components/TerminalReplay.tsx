"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TimelineEvent, EventType } from "@/types/timeline";
import MarkdownContent from "./MarkdownContent";

const TYPE_CONFIG: Record<
  EventType,
  { color: string; icon: string; label: string; prefix?: string }
> = {
  "session.start": {
    color: "var(--accent-purple)",
    icon: "⏵",
    label: "Session",
    prefix: "SESSION START",
  },
  "session.end": {
    color: "var(--accent-purple)",
    icon: "⏹",
    label: "Session",
    prefix: "SESSION END",
  },
  "message.user": {
    color: "var(--accent-blue)",
    icon: "👤",
    label: "User",
    prefix: "user $",
  },
  "message.agent": {
    color: "var(--accent-green)",
    icon: "🤖",
    label: "Agent",
    prefix: "agent >",
  },
  "tool.request": {
    color: "var(--accent-orange)",
    icon: "🔧",
    label: "Tool",
    prefix: "$",
  },
  "tool.result": {
    color: "var(--accent-orange)",
    icon: "📋",
    label: "Result",
  },
  error: {
    color: "var(--accent-red)",
    icon: "⚠",
    label: "Error",
    prefix: "ERROR",
  },
  intent: { color: "var(--accent-cyan)", icon: "💡", label: "Intent" },
  checkpoint: { color: "var(--text-muted)", icon: "📌", label: "Checkpoint" },
  "approval.request": {
    color: "var(--accent-purple)",
    icon: "✋",
    label: "Approval",
  },
  "approval.response": {
    color: "var(--accent-green)",
    icon: "✅",
    label: "Approved",
  },
};

function useTypewriter(text: string, isAnimating: boolean, speed = 20) {
  const [displayed, setDisplayed] = useState(isAnimating ? "" : text);
  const [done, setDone] = useState(!isAnimating);

  useEffect(() => {
    if (!isAnimating) {
      setDisplayed(text);
      setDone(true);
      return;
    }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const step = Math.max(1, Math.floor(text.length / 200));
    const id = setInterval(() => {
      i = Math.min(i + step, text.length);
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, isAnimating, speed]);

  return { displayed, done };
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function ReplayEventBlock({
  event,
  isLatest,
}: {
  event: TimelineEvent;
  isLatest: boolean;
}) {
  const config = TYPE_CONFIG[event.type] ?? {
    color: "var(--text-muted)",
    icon: "•",
    label: event.type,
  };

  const content = getReplayContent(event);
  const { displayed, done } = useTypewriter(content, isLatest, 12);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="group"
    >
      {/* Prompt line */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-xs font-mono font-bold"
          style={{ color: config.color }}
        >
          {config.prefix ?? config.label}
        </span>
        {event.type === "tool.request" && (
          <span className="text-sm font-mono font-semibold text-[var(--accent-orange)]">
            {event.data.tool_name as string}
          </span>
        )}
        <span className="text-xs text-[var(--text-muted)] ml-auto font-mono">
          {formatTime(event.timestamp)}
        </span>
        {event.durationMs !== undefined && (
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {event.durationMs > 1000
              ? `${(event.durationMs / 1000).toFixed(1)}s`
              : `${event.durationMs}ms`}
          </span>
        )}
      </div>

      {/* Content block */}
      {content && (
        <ReplayContentBlock
          event={event}
          displayed={displayed}
          done={done}
          isLatest={isLatest}
        />
      )}
    </motion.div>
  );
}

function ReplayContentBlock({
  event,
  displayed,
  done,
  isLatest,
}: {
  event: TimelineEvent;
  displayed: string;
  done: boolean;
  isLatest: boolean;
}) {
  const isTerminal =
    event.type === "tool.request" ||
    event.type === "tool.result" ||
    event.type === "error";
  const isAgent = event.type === "message.agent";
  const isError = event.type === "error" || (event.data.is_error as boolean);

  if (isAgent) {
    return (
      <div className="pl-4 border-l-2 border-[var(--accent-green)]/30">
        <div className="text-sm text-[var(--text-primary)] leading-relaxed">
          {done ? (
            <MarkdownContent content={displayed} />
          ) : (
            <>
              <MarkdownContent content={displayed} />
              <span className="inline-block w-2 h-4 bg-[var(--accent-green)] animate-pulse ml-0.5 align-middle" />
            </>
          )}
        </div>
      </div>
    );
  }

  if (isTerminal) {
    return (
      <div
        className={`rounded-lg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all max-h-64 overflow-y-auto ${
          isError
            ? "bg-[var(--accent-red)]/10 text-[var(--accent-red)]"
            : "bg-[var(--bg-primary)] text-[var(--text-secondary)]"
        }`}
      >
        {displayed}
        {isLatest && !done && (
          <span className="inline-block w-1.5 h-3 bg-[var(--text-secondary)] animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    );
  }

  return (
    <div className="text-sm text-[var(--text-primary)] leading-relaxed pl-4">
      {displayed}
    </div>
  );
}

function getReplayContent(event: TimelineEvent): string {
  switch (event.type) {
    case "message.user":
    case "message.agent":
      return (event.data.content as string) ?? "";
    case "tool.request": {
      const params = event.data.parameters as Record<string, unknown>;
      if (!params) return "";
      return JSON.stringify(params, null, 2);
    }
    case "tool.result":
      return (event.data.output as string) ?? "";
    case "error":
      return (event.data.message as string) ?? "Unknown error";
    case "session.start":
      return event.data.model
        ? `Model: ${event.data.model as string}`
        : "Session started";
    case "session.end":
      return "Session ended";
    default:
      return "";
  }
}

interface TerminalReplayProps {
  events: TimelineEvent[];
  activeIndex: number;
  onSeek: (index: number) => void;
}

export default function TerminalReplay({
  events,
  activeIndex,
  onSeek,
}: TerminalReplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const visibleEvents = useMemo(
    () => events.slice(0, activeIndex + 1),
    [events, activeIndex]
  );

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeIndex, scrollToBottom]);

  const elapsed = useMemo(() => {
    if (events.length < 2) return "0:00";
    const start = new Date(events[0].timestamp).getTime();
    const current = new Date(
      events[Math.min(activeIndex, events.length - 1)].timestamp
    ).getTime();
    const sec = Math.max(0, Math.floor((current - start) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [events, activeIndex]);

  const total = useMemo(() => {
    if (events.length < 2) return "0:00";
    const start = new Date(events[0].timestamp).getTime();
    const end = new Date(events[events.length - 1].timestamp).getTime();
    const sec = Math.max(0, Math.floor((end - start) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-primary)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--accent-red)]" />
          <div className="w-3 h-3 rounded-full bg-[var(--accent-orange)]" />
          <div className="w-3 h-3 rounded-full bg-[var(--accent-green)]" />
        </div>
        <span className="text-xs font-mono text-[var(--text-muted)]">
          AgentReel Replay -- {elapsed} / {total}
        </span>
        <span className="text-xs font-mono text-[var(--text-muted)]">
          {activeIndex + 1}/{events.length} events
        </span>
      </div>

      {/* Replay area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-primary)]"
      >
        <AnimatePresence mode="popLayout">
          {visibleEvents.map((event, i) => (
            <div
              key={event.seq}
              onClick={() => onSeek(i)}
              className="cursor-pointer"
            >
              <ReplayEventBlock
                event={event}
                isLatest={i === activeIndex}
              />
            </div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
