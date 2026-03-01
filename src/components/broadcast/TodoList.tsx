"use client";

import type { BroadcastPlan } from "@/types/broadcast";

interface TodoListProps {
  plan: BroadcastPlan | null;
  compact?: boolean;
}

export default function TodoList({ plan, compact }: TodoListProps) {
  if (!plan || plan.steps.length === 0) {
    return compact ? null : (
      <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
        Waiting for task plan...
      </div>
    );
  }

  const pct = plan.totalCount > 0 ? (plan.completedCount / plan.totalCount) * 100 : 0;

  if (compact) {
    const activeStep = plan.steps.find((s) => s.status === "active");
    const activeIdx = activeStep?.index ?? plan.completedCount + 1;
    return (
      <div className="flex items-center gap-1.5 px-2.5 h-6 bg-[var(--bg-secondary)] border-y border-[var(--border)] shrink-0">
        <span className="text-[8px] font-semibold text-[var(--text-secondary)] whitespace-nowrap">
          ▶ Step {activeIdx} of {plan.totalCount}
        </span>
        <div className="flex-1 h-[3px] bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-blue)] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[8px] text-[var(--text-muted)] whitespace-nowrap">
          Completed {plan.completedCount} of {plan.totalCount}
        </span>
      </div>
    );
  }

  return (
    <div className="p-2 h-full overflow-y-auto bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Task Progress
        </span>
        <span className="text-[9px] text-[var(--text-secondary)]">
          Completed {plan.completedCount} of {plan.totalCount}
        </span>
      </div>
      <div className="h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-blue)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="space-y-0.5">
        {plan.steps.map((step) => (
          <div key={step.index}>
            <div className="flex items-start gap-1.5 py-0.5">
              <span className="w-3.5 text-center text-[10px] shrink-0">
                {step.status === "done" ? "✅" : step.status === "active" ? (
                  <span className="text-[var(--accent-blue)]">▶</span>
                ) : (
                  <span className="text-[var(--text-muted)]">○</span>
                )}
              </span>
              <span
                className={`text-[10px] leading-snug ${
                  step.status === "done"
                    ? "text-[var(--text-muted)] line-through"
                    : step.status === "active"
                      ? "text-[var(--text-primary)] font-medium"
                      : "text-[var(--text-muted)]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {step.status === "active" && step.substeps?.map((sub, i) => (
              <div key={i} className="flex items-center gap-1 ml-5 py-px">
                <span className="text-[8px] shrink-0">
                  {sub.status === "done" ? (
                    <span className="text-[var(--accent-green)]">✓</span>
                  ) : sub.status === "active" ? (
                    <span className="text-[var(--accent-orange)]">⏳</span>
                  ) : (
                    <span className="text-[var(--text-muted)]">○</span>
                  )}
                </span>
                <span className="text-[9px] text-[var(--text-secondary)]">{sub.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
