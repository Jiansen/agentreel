"use client";

import type { OutputItem } from "@/types/broadcast";

interface OutputPanelProps {
  outputs: OutputItem[];
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export default function OutputPanel({ outputs }: OutputPanelProps) {
  if (outputs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
        No outputs yet
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-1.5 space-y-1">
      {outputs.map((item, i) => (
        <div key={i} className="rounded-md p-1.5 bg-[var(--bg-tertiary)] border-l-[3px] border-l-[var(--accent-cyan)]">
          <span className="text-[7px] font-bold uppercase tracking-wider text-[var(--accent-cyan)] block mb-px">
            {item.type}
          </span>
          <div className="text-[10px] text-[var(--text-secondary)] leading-snug">
            {item.description}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span
              className={`inline-flex items-center gap-0.5 text-[7px] font-semibold px-1 py-px rounded ${
                item.status === "done"
                  ? "bg-[#064e3b] text-[var(--accent-green)]"
                  : "bg-[#451a03] text-[var(--accent-orange)]"
              }`}
            >
              {item.status === "done" ? "✓ Done" : "⏳ Working"}
            </span>
            {item.destination && (
              <span className="text-[7px] text-[var(--accent-cyan)]">{item.destination}</span>
            )}
            {item.readBy !== undefined && (
              <span className="text-[7px] text-[var(--accent-green)]">✓✓ Read by {item.readBy}</span>
            )}
          </div>
          <div className="text-[8px] text-[var(--text-muted)] mt-0.5">
            {formatTime(item.timestamp)}
            {item.size && <span className="ml-1">· {item.size}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
