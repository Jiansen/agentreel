"use client";

import { motion } from "framer-motion";
import type { SessionSummary } from "@/types/timeline";

interface SummaryPanelProps {
  summary: SessionSummary;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export default function SummaryPanel({ summary }: SummaryPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Session Info */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          Session
        </h3>
        <div className="space-y-2">
          <StatRow label="Duration" value={formatDuration(summary.durationMs)} />
          <StatRow label="Events" value={String(summary.eventCount)} />
          <StatRow
            label="Errors"
            value={String(summary.errorCount)}
            highlight={summary.errorCount > 0 ? "red" : undefined}
          />
          {summary.model && <StatRow label="Model" value={summary.model} />}
          {summary.totalTokens !== undefined && (
            <StatRow
              label="Tokens"
              value={summary.totalTokens.toLocaleString()}
            />
          )}
          {summary.totalCostUsd !== undefined && (
            <StatRow
              label="Cost"
              value={formatCost(summary.totalCostUsd)}
            />
          )}
        </div>
      </div>

      {/* Tool Usage */}
      {summary.toolCalls.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Tools ({summary.toolCalls.reduce((sum, t) => sum + t.count, 0)}{" "}
            calls)
          </h3>
          <div className="space-y-1.5">
            {summary.toolCalls.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-tertiary)]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">🔧</span>
                  <span className="text-sm font-mono text-[var(--accent-orange)] truncate">
                    {tool.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[var(--text-muted)]">
                    ×{tool.count}
                  </span>
                  {tool.errors > 0 && (
                    <span className="text-xs text-[var(--accent-red)]">
                      {tool.errors} err
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Summary */}
      {summary.errorCount > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--accent-red)] uppercase tracking-wider mb-3">
            ⚠ {summary.errorCount} Error{summary.errorCount > 1 ? "s" : ""}
          </h3>
          <div className="p-2 rounded-lg bg-[var(--accent-red)]/5 border border-[var(--accent-red)]/20">
            <p className="text-xs text-[var(--accent-red)]">
              Click on error events in the timeline to see details
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "red" | "green";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span
        className={`text-sm font-medium ${
          highlight === "red"
            ? "text-[var(--accent-red)]"
            : highlight === "green"
              ? "text-[var(--accent-green)]"
              : "text-[var(--text-primary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
