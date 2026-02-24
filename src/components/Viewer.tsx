"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import type { ParsedSession, EventType, TimelineEvent } from "@/types/timeline";
import EventCard from "./EventCard";
import SummaryPanel from "./SummaryPanel";
import FilterBar from "./FilterBar";
import PlaybackControls from "./PlaybackControls";
import ShareButton from "./ShareButton";

interface ViewerProps {
  session: ParsedSession;
  jsonlContent: string;
  onReset: () => void;
}

const ALL_VISIBLE_TYPES: EventType[] = [
  "message.user",
  "message.agent",
  "tool.request",
  "tool.result",
  "error",
  "intent",
  "approval.request",
  "approval.response",
];

export default function Viewer({ session, jsonlContent, onReset }: ViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(
    () => new Set(ALL_VISIBLE_TYPES)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);

  const filteredEvents = useMemo(() => {
    return session.events.filter((event) => {
      if (event.type === "session.start" || event.type === "session.end")
        return true;
      if (!activeFilters.has(event.type)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const content = JSON.stringify(event.data).toLowerCase();
        if (!content.includes(q)) return false;
      }
      return true;
    });
  }, [session.events, activeFilters, searchQuery]);

  const toggleFilter = useCallback((type: EventType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleSeek = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, filteredEvents.length - 1));
      setActiveIndex(clamped);
    },
    [filteredEvents.length]
  );

  // Scroll active event into view
  useEffect(() => {
    const el = document.getElementById(`event-${activeIndex}`);
    if (el && timelineRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeIndex]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          handleSeek(activeIndex + 1);
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          handleSeek(activeIndex - 1);
          break;
        case "Home":
          e.preventDefault();
          handleSeek(0);
          break;
        case "End":
          e.preventDefault();
          handleSeek(filteredEvents.length - 1);
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, filteredEvents.length, handleSeek]);

  const activeEvent: TimelineEvent | undefined = filteredEvents[activeIndex];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)]"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onReset}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)] flex items-center justify-center text-xs font-bold text-white">
              ▶
            </div>
            <span className="text-sm font-semibold">
              Agent<span className="text-[var(--accent-blue)]">Reel</span>
            </span>
          </button>
          <span className="text-[var(--text-muted)]">·</span>
          <h2 className="text-sm text-[var(--text-secondary)] truncate max-w-md">
            {session.summary.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <ShareButton
            jsonlContent={jsonlContent}
            title={session.summary.title}
          />
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-hover)] transition-colors"
          >
            Open another
          </button>
        </div>
      </motion.header>

      {/* Filter bar */}
      <FilterBar
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalEvents={session.events.length}
        filteredEvents={filteredEvents.length}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Timeline (left) */}
        <div
          ref={timelineRef}
          className="w-full lg:w-3/5 xl:w-2/3 overflow-y-auto p-4 space-y-1"
        >
          {filteredEvents.map((event, i) => (
            <div key={event.seq} id={`event-${i}`}>
              <EventCard
                event={event}
                isActive={i === activeIndex}
                onClick={() => setActiveIndex(i)}
                index={i}
              />
            </div>
          ))}

          {filteredEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)]">
              <span className="text-2xl mb-2">🔍</span>
              <p>No events match your filters</p>
            </div>
          )}
        </div>

        {/* Summary panel (right) */}
        <div className="hidden lg:block w-2/5 xl:w-1/3 border-l border-[var(--border)] overflow-y-auto p-4">
          <SummaryPanel summary={session.summary} />

          {/* Quick jump to errors */}
          {session.summary.errorCount > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Jump to
              </h3>
              <div className="space-y-1">
                {filteredEvents
                  .filter((e) => e.type === "error")
                  .map((e) => {
                    const idx = filteredEvents.indexOf(e);
                    return (
                      <button
                        key={e.seq}
                        onClick={() => setActiveIndex(idx)}
                        className="w-full text-left p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group"
                      >
                        <span className="text-xs text-[var(--accent-red)] group-hover:underline">
                          ⚠ Error at #{e.seq}
                        </span>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {(e.data.message as string)?.slice(0, 80) ?? "Error"}
                        </p>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Active event detail (for context) */}
          {activeEvent && (
            <div className="mt-5 pt-5 border-t border-[var(--border)]">
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Selected Event
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                #{activeEvent.seq} · {activeEvent.type} ·{" "}
                {new Date(activeEvent.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Playback controls */}
      <PlaybackControls
        events={filteredEvents}
        activeIndex={activeIndex}
        onSeek={handleSeek}
      />
    </div>
  );
}
