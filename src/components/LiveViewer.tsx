"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Viewer from "./Viewer";
import { parseOpenClawJsonl } from "@/lib/parsers/openclaw";
import type { ParsedSession } from "@/types/timeline";

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

export default function LiveViewer() {
  const [session, setSession] = useState<ParsedSession | null>(null);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [connState, setConnState] = useState<ConnectionState>("disconnected");
  const [inputUrl, setInputUrl] = useState("");
  const [eventCount, setEventCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const eventSourceRef = useRef<EventSource | null>(null);

  const rebuildSession = useCallback((lines: string[]) => {
    if (lines.length === 0) return;
    try {
      const jsonl = lines.join("\n");
      const parsed = parseOpenClawJsonl(jsonl);
      setSession(parsed);
      setEventCount(parsed.events.length);
    } catch {
      // Partial data — wait for more
    }
  }, []);

  const connect = useCallback(
    (url: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setConnState("connecting");

      const sseUrl = url.endsWith("/api/stream")
        ? url
        : `${url.replace(/\/$/, "")}/api/stream`;

      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      const accumulated: string[] = [];

      es.addEventListener("event", (e) => {
        accumulated.push(e.data);
        setRawLines([...accumulated]);
        setLastUpdate(new Date().toLocaleTimeString());
        rebuildSession(accumulated);
      });

      es.addEventListener("heartbeat", () => {
        setLastUpdate(new Date().toLocaleTimeString());
      });

      es.onopen = () => {
        setConnState("connected");
      };

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          setConnState("disconnected");
        } else {
          setConnState("error");
        }
      };
    },
    [rebuildSession]
  );

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnState("disconnected");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("stream");
    if (url) {
      setInputUrl(url);
      connect(url);
    } else {
      const defaultRelay = `${window.location.origin}/api/relay`;
      setInputUrl(defaultRelay);
      connect(defaultRelay);
    }
    return () => disconnect();
  }, [connect, disconnect]);

  const handleReset = useCallback(() => {
    disconnect();
    setSession(null);
    setRawLines([]);
    setEventCount(0);
  }, [disconnect]);

  if (session) {
    return (
      <div className="relative">
        {/* Live indicator bar */}
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-1.5 bg-[var(--accent-red)]/90 text-white text-xs backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            <span className="font-semibold uppercase tracking-wider">Live</span>
            <span className="opacity-70">·</span>
            <span className="opacity-70">{eventCount} events</span>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="opacity-70">Last update: {lastUpdate}</span>
            )}
            <button
              onClick={handleReset}
              className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
        <div className="pt-7">
          <Viewer
            session={session}
            jsonlContent={rawLines.join("\n")}
            onReset={handleReset}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-red)] to-[var(--accent-orange)] flex items-center justify-center text-xl font-bold text-white">
            ●
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Agent<span className="text-[var(--accent-red)]">Reel</span>{" "}
            <span className="text-[var(--text-muted)] text-2xl font-normal">
              Live
            </span>
          </h1>
        </div>
        <p className="text-[var(--text-secondary)] text-lg max-w-md">
          Watch AI agents work in real-time.
          <br />
          Connect to a relay server to start streaming.
        </p>
      </div>

      <div className="w-full max-w-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="http://relay-server:8765"
            className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-red)]/50 focus:outline-none transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter" && inputUrl) connect(inputUrl);
            }}
          />
          <button
            onClick={() => inputUrl && connect(inputUrl)}
            disabled={!inputUrl || connState === "connecting"}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--accent-red)] to-[var(--accent-orange)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {connState === "connecting" ? "Connecting..." : "Connect"}
          </button>
        </div>

        {connState === "error" && (
          <p className="mt-3 text-sm text-[var(--accent-red)]">
            Connection failed. Check the relay server URL and try again.
          </p>
        )}

        {connState === "connected" && rawLines.length === 0 && (
          <div className="mt-6 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
              <span className="text-sm text-green-400 font-medium">
                Connected — waiting for agent activity
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Send a task to your OpenClaw agent (via Telegram or CLI) and it
              will appear here automatically.
            </p>
            <pre className="mt-2 text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] p-2 rounded-lg">
              {`openclaw agent --session-id demo --message "What's trending on HN?"`}
            </pre>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-[var(--text-muted)] mb-4">
            How to set up a relay server:
          </p>
          <pre className="text-left p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--text-secondary)] overflow-x-auto">
{`# Install AgentReel (includes relay server):
curl -fsSL https://raw.githubusercontent.com/Jiansen/agentreel/main/install.sh | bash
agentreel start

# Or manually:
python3 relay_server.py --watch-dir ~/.openclaw/sessions/ --port 8765`}
          </pre>
        </div>
      </div>
    </div>
  );
}
