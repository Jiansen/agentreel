"use client";

import { useState } from "react";
import type { EventType } from "@/types/timeline";

const FILTER_OPTIONS: { type: EventType; label: string; color: string }[] = [
  { type: "message.user", label: "User", color: "var(--accent-blue)" },
  { type: "message.agent", label: "Agent", color: "var(--accent-green)" },
  { type: "tool.request", label: "Tools", color: "var(--accent-orange)" },
  { type: "tool.result", label: "Results", color: "var(--accent-orange)" },
  { type: "error", label: "Errors", color: "var(--accent-red)" },
];

interface FilterBarProps {
  activeFilters: Set<EventType>;
  onToggleFilter: (type: EventType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalEvents: number;
  filteredEvents: number;
}

export default function FilterBar({
  activeFilters,
  onToggleFilter,
  searchQuery,
  onSearchChange,
  totalEvents,
  filteredEvents,
}: FilterBarProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
      {/* Search */}
      <div
        className={`
          relative flex items-center gap-2 px-3 py-1.5 rounded-lg
          border transition-colors flex-1 max-w-xs
          ${
            isSearchFocused
              ? "border-[var(--accent-blue)]/50 bg-[var(--bg-tertiary)]"
              : "border-[var(--border)] bg-[var(--bg-primary)]"
          }
        `}
      >
        <span className="text-[var(--text-muted)] text-sm">🔍</span>
        <input
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          className="bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none flex-1"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Type filters */}
      <div className="flex items-center gap-1">
        {FILTER_OPTIONS.map((opt) => {
          const isActive = activeFilters.has(opt.type);
          return (
            <button
              key={opt.type}
              onClick={() => onToggleFilter(opt.type)}
              className={`
                text-xs px-2 py-1 rounded-md transition-all
                ${
                  isActive
                    ? "opacity-100"
                    : "opacity-40 hover:opacity-70"
                }
              `}
              style={{
                background: isActive ? `${opt.color}20` : "transparent",
                color: opt.color,
                border: `1px solid ${isActive ? `${opt.color}40` : "transparent"}`,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Count */}
      {filteredEvents !== totalEvents && (
        <span className="text-xs text-[var(--text-muted)] shrink-0">
          {filteredEvents}/{totalEvents}
        </span>
      )}
    </div>
  );
}
