"use client";

import { useState, useEffect, useCallback } from "react";

interface Tab {
  label: string;
  content: React.ReactNode;
}

interface TabCyclerProps {
  tabs: Tab[];
  intervalMs?: number;
  paused?: boolean;
}

export default function TabCycler({ tabs, intervalMs = 10000, paused = false }: TabCyclerProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const advance = useCallback(() => {
    setActiveIdx((prev) => (prev + 1) % tabs.length);
  }, [tabs.length]);

  useEffect(() => {
    if (paused || isHovered || tabs.length <= 1) return;
    const timer = setInterval(advance, intervalMs);
    return () => clearInterval(timer);
  }, [advance, intervalMs, paused, isHovered, tabs.length]);

  if (tabs.length === 0) return null;

  return (
    <div
      className="flex flex-col h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex border-b border-[var(--border)] shrink-0">
        {tabs.map((tab, i) => (
          <button
            key={i}
            className={`flex-1 py-1.5 text-center text-[8px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              i === activeIdx
                ? "text-[var(--text-primary)] border-b-[var(--accent-blue)]"
                : "text-[var(--text-muted)] border-b-transparent hover:text-[var(--text-secondary)]"
            }`}
            onClick={() => setActiveIdx(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {tabs[activeIdx]?.content}
      </div>
    </div>
  );
}
