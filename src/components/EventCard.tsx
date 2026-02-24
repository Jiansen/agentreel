"use client";

import { motion } from "framer-motion";
import type { TimelineEvent, EventType } from "@/types/timeline";
import { useState } from "react";
import MarkdownContent from "./MarkdownContent";

const TYPE_CONFIG: Record<
  EventType,
  { color: string; icon: string; label: string }
> = {
  "session.start": {
    color: "var(--accent-purple)",
    icon: "⏵",
    label: "Session Start",
  },
  "session.end": {
    color: "var(--accent-purple)",
    icon: "⏹",
    label: "Session End",
  },
  "message.user": {
    color: "var(--accent-blue)",
    icon: "👤",
    label: "User",
  },
  "message.agent": {
    color: "var(--accent-green)",
    icon: "🤖",
    label: "Agent",
  },
  "tool.request": {
    color: "var(--accent-orange)",
    icon: "🔧",
    label: "Tool Call",
  },
  "tool.result": {
    color: "var(--accent-orange)",
    icon: "📋",
    label: "Tool Result",
  },
  error: {
    color: "var(--accent-red)",
    icon: "⚠",
    label: "Error",
  },
  intent: {
    color: "var(--accent-cyan)",
    icon: "💡",
    label: "Intent",
  },
  checkpoint: {
    color: "var(--text-muted)",
    icon: "📌",
    label: "Checkpoint",
  },
  "approval.request": {
    color: "var(--accent-purple)",
    icon: "✋",
    label: "Approval Request",
  },
  "approval.response": {
    color: "var(--accent-green)",
    icon: "✅",
    label: "Approval",
  },
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

interface EventCardProps {
  event: TimelineEvent;
  isActive: boolean;
  onClick: () => void;
  index: number;
}

export default function EventCard({
  event,
  isActive,
  onClick,
  index,
}: EventCardProps) {
  const config = TYPE_CONFIG[event.type] ?? {
    color: "var(--text-muted)",
    icon: "•",
    label: event.type,
  };
  const [showRaw, setShowRaw] = useState(false);

  const preview = getEventPreview(event);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.5), layout: { duration: 0.2 } }}
      onClick={onClick}
      className={`
        relative flex items-start gap-3 p-3 rounded-xl cursor-pointer
        transition-colors duration-200
        ${
          isActive
            ? "bg-[var(--bg-tertiary)] border border-[var(--border)] shadow-lg shadow-[var(--accent-blue)]/5"
            : "hover:bg-[var(--bg-hover)] border border-transparent"
        }
        ${event.type === "error" ? "border-l-2 border-l-[var(--accent-red)]" : ""}
      `}
    >
      {/* Dot + connector */}
      <div className="flex flex-col items-center shrink-0 mt-1">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
          style={{ background: `${config.color}20`, color: config.color }}
        >
          {config.icon}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ background: `${config.color}15`, color: config.color }}
          >
            {config.label}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {formatTimestamp(event.timestamp)}
          </span>
          {event.durationMs !== undefined && (
            <span className="text-xs text-[var(--text-muted)]">
              {event.durationMs > 1000
                ? `${(event.durationMs / 1000).toFixed(1)}s`
                : `${event.durationMs}ms`}
            </span>
          )}
          {event.type === "tool.request" && (
            <span className="text-xs font-mono text-[var(--accent-orange)]">
              {event.data.tool_name as string}
            </span>
          )}
        </div>
        {preview && (
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2">
            {truncate(preview, 200)}
          </p>
        )}

        {/* Expanded details when active */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-3"
          >
            <EventDetail event={event} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRaw(!showRaw);
              }}
              className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline"
            >
              {showRaw ? "Hide raw" : "View raw JSON"}
            </button>
            {showRaw && (
              <pre className="mt-2 p-3 rounded-lg bg-[var(--bg-primary)] text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto text-[var(--text-secondary)]">
                {JSON.stringify(event.raw, null, 2)}
              </pre>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function getEventPreview(event: TimelineEvent): string {
  switch (event.type) {
    case "message.user":
    case "message.agent":
      return (event.data.content as string) ?? "";
    case "tool.request": {
      const params = event.data.parameters as Record<string, unknown>;
      if (!params) return "";
      const keys = Object.keys(params);
      if (keys.length === 0) return "";
      if (keys.length === 1) {
        const v = params[keys[0]];
        const vs = typeof v === "string" ? v : JSON.stringify(v);
        return `${keys[0]}: ${truncate(vs ?? "", 120)}`;
      }
      return keys
        .slice(0, 3)
        .map((k) => {
          const v = params[k];
          const vs =
            typeof v === "string" ? v : JSON.stringify(v);
          return `${k}: ${truncate(vs ?? "", 60)}`;
        })
        .join(", ");
    }
    case "tool.result":
      return (event.data.output as string) ?? "";
    case "error":
      return (event.data.message as string) ?? "";
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

function EventDetail({ event }: { event: TimelineEvent }) {
  switch (event.type) {
    case "message.user": {
      const content = (event.data.content as string) ?? "";
      return (
        <div className="text-sm whitespace-pre-wrap break-words text-[var(--text-primary)]">
          {content}
        </div>
      );
    }
    case "message.agent": {
      const content = (event.data.content as string) ?? "";
      const meta: string[] = [];
      if (event.data.model) meta.push(`Model: ${event.data.model as string}`);
      if (event.data.tokens) meta.push(`${(event.data.tokens as number).toLocaleString()} tokens`);
      if (event.data.cost_usd) meta.push(`$${(event.data.cost_usd as number).toFixed(4)}`);
      if (event.data.duration_ms) meta.push(`${((event.data.duration_ms as number) / 1000).toFixed(1)}s`);

      return (
        <div>
          {meta.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {meta.map((m, i) => (
                <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)]">
                  {m}
                </span>
              ))}
            </div>
          )}
          <MarkdownContent content={content} />
        </div>
      );
    }
    case "tool.request": {
      const params = event.data.parameters as Record<string, unknown>;
      return (
        <div>
          <div className="text-sm font-medium text-[var(--accent-orange)] mb-2">
            {event.data.tool_name as string}
          </div>
          <pre className="p-3 rounded-lg bg-[var(--bg-primary)] text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto text-[var(--text-secondary)]">
            {JSON.stringify(params, null, 2)}
          </pre>
        </div>
      );
    }
    case "tool.result": {
      const output = (event.data.output as string) ?? "";
      const isError = event.data.is_error as boolean;
      return (
        <div
          className={`p-3 rounded-lg text-sm font-mono whitespace-pre-wrap break-all max-h-64 overflow-y-auto ${
            isError
              ? "bg-[var(--accent-red)]/10 text-[var(--accent-red)]"
              : "bg-[var(--bg-primary)] text-[var(--text-secondary)]"
          }`}
        >
          {output}
        </div>
      );
    }
    case "error":
      return (
        <div className="p-3 rounded-lg bg-[var(--accent-red)]/10 text-[var(--accent-red)] text-sm">
          {(event.data.message as string) ?? "Unknown error"}
        </div>
      );
    default:
      return null;
  }
}
