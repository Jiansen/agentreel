"use client";

import { useRef, useEffect, useState, useMemo } from "react";

export interface TerminalLine {
  time: string;
  icon: string;
  text: string;
  className: string;
}

interface AgentTerminalProps {
  rawLines: string[];
  sessionId?: string;
  maxLines?: number;
}

function parseRawLine(raw: string): TerminalLine | null {
  try {
    const obj = JSON.parse(raw);
    const ts = obj.timestamp
      ? new Date(typeof obj.timestamp === "number" ? obj.timestamp : obj.timestamp).toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "";

    if (obj.type === "session") {
      return {
        time: ts,
        icon: "🚀",
        text: `Session started: ${obj.id ?? "unknown"} (model: ${obj.modelId ?? "?"})`,
        className: "term-session",
      };
    }

    if (obj.type === "model_change") {
      return {
        time: ts,
        icon: "🔄",
        text: `Model: ${obj.provider ?? ""}/${obj.modelId ?? ""}`,
        className: "term-model",
      };
    }

    if (obj.type === "message" && obj.message) {
      const msg = obj.message;
      const role = msg.role;
      const content = Array.isArray(msg.content)
        ? msg.content
            .map((b: { type: string; text?: string; thinking?: string; name?: string }) => {
              if (b.type === "text") return b.text ?? "";
              if (b.type === "thinking") return b.thinking ?? "";
              if (b.type === "toolCall" || b.type === "tool_use") return `[tool: ${b.name ?? "?"}]`;
              return "";
            })
            .filter(Boolean)
            .join(" ")
        : typeof msg.content === "string"
          ? msg.content
          : "";

      if (role === "user") {
        return {
          time: ts,
          icon: "👤",
          text: content.slice(0, 200),
          className: "term-user",
        };
      }

      if (role === "assistant") {
        const hasThinking = Array.isArray(msg.content) && msg.content.some((b: { type: string }) => b.type === "thinking");
        const hasToolCall = Array.isArray(msg.content) && msg.content.some((b: { type: string }) => b.type === "toolCall" || b.type === "tool_use");

        if (hasThinking) {
          const thinkText = Array.isArray(msg.content)
            ? msg.content
                .filter((b: { type: string }) => b.type === "thinking")
                .map((b: { thinking?: string }) => b.thinking ?? "")
                .join(" ")
            : "";
          return {
            time: ts,
            icon: "🧠",
            text: thinkText.slice(0, 200),
            className: "term-thinking",
          };
        }

        if (hasToolCall) {
          const toolNames = Array.isArray(msg.content)
            ? msg.content
                .filter((b: { type: string }) => b.type === "toolCall" || b.type === "tool_use")
                .map((b: { name?: string }) => b.name ?? "?")
            : [];
          return {
            time: ts,
            icon: "🔧",
            text: `Calling: ${toolNames.join(", ")}`,
            className: "term-tool",
          };
        }

        return {
          time: ts,
          icon: "💬",
          text: content.slice(0, 200),
          className: "term-agent",
        };
      }

      if (role === "toolResult" || role === "tool_result") {
        const toolName = msg.toolName ?? "";
        const isError = msg.isError;
        return {
          time: ts,
          icon: isError ? "❌" : "✅",
          text: `${toolName}${isError ? " (error)" : " → done"}`,
          className: isError ? "term-error" : "term-result",
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function TypewriterLine({ line, speed = 20 }: { line: TerminalLine; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      if (idx >= line.text.length) {
        setDisplayed(line.text);
        setDone(true);
        clearInterval(timer);
      } else {
        setDisplayed(line.text.slice(0, idx));
      }
    }, speed);
    return () => clearInterval(timer);
  }, [line.text, speed]);

  return (
    <span className={line.className}>
      {displayed}
      {!done && <span className="term-cursor" />}
    </span>
  );
}

export default function AgentTerminal({ rawLines, sessionId, maxLines = 30 }: AgentTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const lines = useMemo(() => {
    const parsed: TerminalLine[] = [];
    for (const raw of rawLines) {
      const line = parseRawLine(raw);
      if (line) parsed.push(line);
    }
    return parsed.slice(-maxLines);
  }, [rawLines, maxLines]);

  const lastIdx = lines.length - 1;
  const isNewLine = lines.length > prevCountRef.current;

  useEffect(() => {
    prevCountRef.current = lines.length;
  }, [lines.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines.length]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a14] border-t border-[var(--border)]">
      <div className="flex items-center gap-2 px-2 py-1 bg-[#0d0d1a] border-b border-[#1a1a2e] shrink-0">
        <span className="flex gap-1">
          <span className="w-[7px] h-[7px] rounded-full bg-[#ff5f57]" />
          <span className="w-[7px] h-[7px] rounded-full bg-[#febc2e]" />
          <span className="w-[7px] h-[7px] rounded-full bg-[#28c840]" />
        </span>
        <span className="text-[9px] text-[#6a6a8a] font-mono">Agent Desktop — terminal</span>
        {sessionId && (
          <span className="text-[8px] text-[#3a3a5a] font-mono ml-auto">{sessionId}</span>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-1.5 font-mono text-[9px] leading-[1.6] space-y-px">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[#3a3a5a]">
            <div className="text-[10px] font-mono">
              $ tail -f session.jsonl<span className="term-cursor" />
            </div>
            <div className="text-[8px] animate-pulse">Waiting for agent events...</div>
          </div>
        ) : (
          lines.map((line, i) => {
            const isLast = i === lastIdx && isNewLine;
            return (
              <div key={`${i}-${line.time}`} className="flex gap-1.5 items-start">
                <span className="text-[#4a4a6a] shrink-0 w-[52px] text-right">{line.time}</span>
                <span className="shrink-0">{line.icon}</span>
                {isLast ? (
                  <TypewriterLine line={line} speed={18} />
                ) : (
                  <span className={line.className}>{line.text}</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
