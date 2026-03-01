"use client";

import { useRef, useEffect, useState } from "react";
import type { FormatTagEvent } from "@/types/broadcast";

interface StreamCardsProps {
  events: FormatTagEvent[];
  compact?: boolean;
}

const TAG_STYLES: Record<string, { border: string; color: string; label: string }> = {
  thinking:    { border: "border-l-[var(--accent-purple)]", color: "text-[var(--accent-purple)]", label: "Thinking" },
  discovery:   { border: "border-l-[var(--accent-green)]",  color: "text-[var(--accent-green)]",  label: "Discovery" },
  challenge:   { border: "border-l-[var(--accent-orange)]", color: "text-[var(--accent-orange)]", label: "Challenge" },
  browse:      { border: "border-l-[var(--accent-blue)]",   color: "text-[var(--accent-blue)]",   label: "Browse" },
  output:      { border: "border-l-[var(--accent-cyan)]",   color: "text-[var(--accent-cyan)]",   label: "Output" },
  message_in:  { border: "border-l-[#f472b6]",             color: "text-[#f472b6]",             label: "← Message" },
  message_out: { border: "border-l-[#60a5fa]",             color: "text-[#60a5fa]",             label: "→ Reply" },
  summary:     { border: "border-l-[var(--accent-green)]",  color: "text-[var(--accent-green)]",  label: "Summary" },
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

function TypewriterText({ text, speed = 30 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      if (idx >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(timer);
      } else {
        setDisplayed(text.slice(0, idx));
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!done && <span className="inline-block w-[2px] h-[1em] bg-current animate-pulse ml-px align-text-bottom" />}
    </span>
  );
}

export default function StreamCards({ events, compact }: StreamCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
        Waiting for events...
      </div>
    );
  }

  const fontSize = compact ? "text-[9px]" : "text-[10px]";
  const tagSize = compact ? "text-[7px]" : "text-[7px]";
  const metaSize = compact ? "text-[7px]" : "text-[8px]";
  const lastIdx = events.length - 1;

  return (
    <div ref={scrollRef} className="overflow-y-auto h-full p-1.5 space-y-1">
      {events.map((ev, i) => {
        const style = TAG_STYLES[ev.type] ?? TAG_STYLES.browse;
        const isLatest = i === lastIdx;
        return (
          <div
            key={`${i}-${ev.timestamp}`}
            className={`rounded-md p-1.5 bg-[var(--bg-tertiary)] border-l-[3px] ${style.border} ${
              isLatest ? "ring-1 ring-[var(--border)] shadow-sm" : ""
            }`}
          >
            <span className={`${tagSize} font-bold uppercase tracking-wider ${style.color} block mb-px`}>
              {style.label}
              {isLatest && <span className="ml-1 inline-block w-1 h-1 rounded-full bg-current animate-pulse" />}
            </span>
            <div className={`${fontSize} text-[var(--text-secondary)] leading-snug line-clamp-3`}>
              {isLatest ? <TypewriterText text={ev.text} speed={25} /> : ev.text}
            </div>
            <div className={`${metaSize} text-[var(--text-muted)] mt-0.5`}>
              {formatTime(ev.timestamp)}
              {ev.meta?.sender && <span className="ml-1">· {ev.meta.sender}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
