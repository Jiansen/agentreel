"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ParsedSession, EventType, TimelineEvent } from "@/types/timeline";
import EventCard from "./EventCard";
import SummaryPanel from "./SummaryPanel";
import FilterBar from "./FilterBar";
import ShareButton from "./ShareButton";
import VideoPlayer from "./VideoPlayer";
import type { VideoPlayerHandle } from "./VideoPlayer";
import ReportPanel from "./ReportPanel";

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

interface SideBySideViewerProps {
  session: ParsedSession;
  jsonlContent: string;
  videoUrl: string;
  onReset: () => void;
}

export default function SideBySideViewer({
  session,
  jsonlContent,
  videoUrl,
  onReset,
}: SideBySideViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(
    () => new Set(ALL_VISIBLE_TYPES)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [rightTab, setRightTab] = useState<"timeline" | "report">("timeline");
  const videoRef = useRef<VideoPlayerHandle>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const hasReport = !!session.summary.report;

  const handleVideoEnded = useCallback(() => {
    if (hasReport) setRightTab("report");
  }, [hasReport]);

  const sessionStartMs = useMemo(() => {
    if (session.events.length === 0) return 0;
    return new Date(session.events[0].timestamp).getTime();
  }, [session.events]);

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
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleSeek = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, filteredEvents.length - 1));
      setActiveIndex(clamped);

      const event = filteredEvents[clamped];
      if (event && videoRef.current) {
        const eventMs = new Date(event.timestamp).getTime();
        const offsetSec = Math.max(0, (eventMs - sessionStartMs) / 1000);
        videoRef.current.seekTo(offsetSec);
      }
    },
    [filteredEvents, sessionStartMs]
  );

  const handleVideoTimeUpdate = useCallback(
    (currentTime: number) => {
      const videoMs = sessionStartMs + currentTime * 1000;
      let bestIdx = 0;
      for (let i = 0; i < filteredEvents.length; i++) {
        const evMs = new Date(filteredEvents[i].timestamp).getTime();
        if (evMs <= videoMs) bestIdx = i;
        else break;
      }
      setActiveIndex(bestIdx);
    },
    [filteredEvents, sessionStartMs]
  );

  useEffect(() => {
    const el = document.getElementById(`sbs-event-${activeIndex}`);
    if (el && timelineRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeIndex]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
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
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, handleSeek]);

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
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--accent-purple)]/15 text-[var(--accent-purple)]">
            Side-by-Side
          </span>
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

      {/* Side-by-side content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Video */}
        <div className="w-1/2 border-r border-[var(--border)]">
          <VideoPlayer
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleVideoEnded}
          />
        </div>

        {/* Right: Tab panel */}
        <div className="w-1/2 flex flex-col">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
            <button
              onClick={() => setRightTab("timeline")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                rightTab === "timeline"
                  ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setRightTab("report")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                rightTab === "report"
                  ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Report
              {hasReport && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
              )}
            </button>
          </div>

          {/* Tab content */}
          {rightTab === "timeline" ? (
            <>
              <div
                ref={timelineRef}
                className="flex-1 overflow-y-auto p-3 space-y-1"
              >
                <AnimatePresence mode="popLayout">
                  {filteredEvents.map((event, i) => (
                    <motion.div
                      key={event.seq}
                      id={`sbs-event-${i}`}
                      layout
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                    >
                      <EventCard
                        event={event}
                        isActive={i === activeIndex}
                        onClick={() => handleSeek(i)}
                        index={i}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Mini summary */}
              <div className="border-t border-[var(--border)] p-3 bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span>{filteredEvents.length} events</span>
                  <span>{session.summary.toolCalls.length} tool types</span>
                  {session.summary.errorCount > 0 && (
                    <span className="text-[var(--accent-red)]">
                      {session.summary.errorCount} errors
                    </span>
                  )}
                  {session.summary.model && (
                    <span>{session.summary.model}</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <ReportPanel summary={session.summary} />
          )}
        </div>
      </div>
    </div>
  );
}
