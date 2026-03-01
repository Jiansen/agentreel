"use client";

import type { MessageItem } from "@/types/broadcast";

interface MessagePanelProps {
  messages: MessageItem[];
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export default function MessagePanel({ messages }: MessagePanelProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
        No messages yet
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full p-1.5 space-y-1">
      {messages.map((msg, i) => {
        const isIn = msg.direction === "in";
        return (
          <div
            key={i}
            className={`rounded-md p-1.5 bg-[var(--bg-tertiary)] border-l-[3px] ${
              isIn ? "border-l-[#f472b6]" : "border-l-[#60a5fa]"
            }`}
          >
            <div className="flex items-center gap-1 mb-px">
              <span
                className={`text-[6px] font-bold px-1 py-px rounded ${
                  isIn ? "bg-[#3b1d4e] text-[#c084fc]" : "bg-[#1e3a5f] text-[#60a5fa]"
                }`}
              >
                {isIn ? "IN" : "OUT"}
              </span>
              <span className={`text-[8px] font-semibold ${isIn ? "text-[#f472b6]" : "text-[#60a5fa]"}`}>
                {msg.sender}
              </span>
              {msg.read && (
                <span className="text-[7px] text-[var(--accent-green)] ml-auto">
                  ✓✓{msg.readBy !== undefined ? ` Read by ${msg.readBy}` : ""}
                </span>
              )}
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] leading-snug">
              {msg.text}
            </div>
            <div className="text-[8px] text-[var(--text-muted)] mt-0.5">
              {formatTime(msg.timestamp)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
