"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { parseOpenClawJsonl } from "@/lib/parsers/openclaw";
import { extractBroadcastData } from "@/lib/parsers/format-tags";
import type { BroadcastData, BroadcastPreset } from "@/types/broadcast";
import ClassicSplit from "./ClassicSplit";
import Focus from "./Focus";

interface BroadcastLayoutProps {
  preset: BroadcastPreset;
  vncUrl: string;
  relayUrl: string;
  tabIntervalMs?: number;
  missionName?: string;
}

const EMPTY_DATA: BroadcastData = {
  plan: null,
  events: [],
  outputs: [],
  messages: [],
  summary: null,
  missionName: "Waiting for task...",
  isLive: true,
  elapsedMs: 0,
  activityStatus: "idle",
  lastEventTime: null,
};

export default function BroadcastLayout({
  preset,
  vncUrl,
  relayUrl,
  tabIntervalMs = 10000,
  missionName,
}: BroadcastLayoutProps) {
  const [data, setData] = useState<BroadcastData>(EMPTY_DATA);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const rawLinesRef = useRef<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const rebuildData = useCallback(
    (lines: string[]) => {
      if (lines.length === 0) return;
      try {
        const jsonl = lines.join("\n");
        const session = parseOpenClawJsonl(jsonl);
        const broadcastData = extractBroadcastData(session.events, { missionName });
        setData(broadcastData);
      } catch {
        // Partial data — wait for more
      }
    },
    [missionName]
  );

  const connect = useCallback(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    if (!relayUrl) return;

    setConnectionState("connecting");
    startTimeRef.current = Date.now();
    const sseUrl = relayUrl.endsWith("/api/stream") ? relayUrl : `${relayUrl.replace(/\/$/, "")}/api/stream`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener("event", (e) => {
      rawLinesRef.current.push(e.data);
      rebuildData(rawLinesRef.current);
    });

    es.onopen = () => setConnectionState("connected");
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setConnectionState("disconnected");
      } else {
        setConnectionState("error");
      }
    };
  }, [relayUrl, rebuildData]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [connect]);

  // Keep elapsed timer ticking
  useEffect(() => {
    elapsedTimerRef.current = setInterval(() => {
      setData((prev) => ({
        ...prev,
        elapsedMs: Date.now() - startTimeRef.current,
      }));
    }, 1000);
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  const displayData = {
    ...data,
    isLive: connectionState === "connected",
  };

  if (preset === "portrait") {
    return <Focus data={displayData} vncUrl={vncUrl} />;
  }

  return (
    <ClassicSplit
      data={displayData}
      vncUrl={vncUrl}
      rawLines={rawLinesRef.current}
      tabIntervalMs={tabIntervalMs}
    />
  );
}
