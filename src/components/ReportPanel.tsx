"use client";

import { motion } from "framer-motion";
import type { SessionSummary } from "@/types/timeline";
import MarkdownContent from "./MarkdownContent";

interface ReportPanelProps {
  summary: SessionSummary;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${remSec}s`;
}

export default function ReportPanel({ summary }: ReportPanelProps) {
  if (!summary.report) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-[var(--text-muted)]">
          <div className="text-3xl mb-3">📄</div>
          <p className="text-sm">No report generated</p>
          <p className="text-xs mt-1">
            The agent did not produce a final text deliverable in this session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex-1 overflow-y-auto"
    >
      {/* Status badges */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-5 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex-wrap">
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--accent-green)]/15 text-[var(--accent-green)]">
          Task Complete
        </span>
        {summary.durationMs > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
            {formatDuration(summary.durationMs)}
          </span>
        )}
        {summary.model && (
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
            {summary.model}
          </span>
        )}
        {summary.totalTokens && (
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
            {summary.totalTokens.toLocaleString()} tokens
          </span>
        )}
        {summary.totalCostUsd && (
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
            ${summary.totalCostUsd.toFixed(4)}
          </span>
        )}
      </div>

      {/* Report content */}
      <div className="p-5">
        <MarkdownContent content={summary.report} />
      </div>
    </motion.div>
  );
}
