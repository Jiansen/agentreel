"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import BroadcastLayout from "@/components/broadcast/BroadcastLayout";
import type { BroadcastPreset } from "@/types/broadcast";

function getStoredLiveToken(): string {
  if (typeof window === "undefined") return "";
  return (
    document.cookie.replace(
      /(?:(?:^|.*;\s*)agentreel_live\s*=\s*([^;]*).*$)|^.*$/,
      "$1"
    ) ||
    localStorage.getItem("agentreel_live") ||
    ""
  );
}

function storeLiveToken(token: string) {
  document.cookie = `agentreel_live=${token}; path=/; max-age=31536000; SameSite=Strict`;
  localStorage.setItem("agentreel_live", token);
}

export default function BroadcastClient() {
  const params = useSearchParams();
  const [accessState, setAccessState] = useState<
    "checking" | "authorized" | "denied"
  >("checking");
  const [tokenInput, setTokenInput] = useState("");
  const [detectedVncUrl, setDetectedVncUrl] = useState<string>("");

  const preset = (params.get("preset") ?? "landscape") as BroadcastPreset;
  const vncUrlParam = params.get("vnc") ?? "";
  const relayUrl = params.get("relay") ?? "/api/relay";
  const tabInterval = parseInt(params.get("tabInterval") ?? "10000", 10);
  const missionName = params.get("mission") ?? undefined;
  const vncUrl = vncUrlParam || detectedVncUrl;

  useEffect(() => {
    if (vncUrlParam) return;
    fetch("/api/vnc-status")
      .then((r) => r.json())
      .then((data) => {
        if (data.available) {
          const host = window.location.hostname;
          setDetectedVncUrl(
            `http://${host}:${data.port}${data.path}`
          );
        }
      })
      .catch(() => {});
  }, [vncUrlParam]);

  const checkAccess = useCallback(
    async (token?: string) => {
      const t = token || params.get("token") || getStoredLiveToken();
      const url = t ? `/api/access?token=${encodeURIComponent(t)}` : "/api/access";

      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.authorized) {
          setAccessState("authorized");
          if (t) {
            storeLiveToken(t);
            // Add token to URL so Share button includes it
            const u = new URL(window.location.href);
            if (!u.searchParams.has("token")) {
              u.searchParams.set("token", t);
              window.history.replaceState({}, "", u.toString());
            }
          }
        } else {
          setAccessState("denied");
        }
      } catch {
        setAccessState("authorized"); // If API fails (e.g. no config), default to open
      }
    },
    [params]
  );

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  if (accessState === "checking") {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">
        Loading...
      </div>
    );
  }

  if (accessState === "denied") {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔐</div>
          <h1 className="text-xl font-bold text-white mb-2">
            This stream is private
          </h1>
          <p className="text-gray-400 text-sm mb-4">
            Enter the viewer token to watch this live session.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tokenInput.trim()) {
                setAccessState("checking");
                checkAccess(tokenInput.trim());
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Enter viewer token..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Enter
            </button>
          </form>
          <p className="text-gray-600 text-xs mt-3">
            Ask the stream owner for the viewer token.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-screen h-screen overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      <BroadcastLayout
        preset={preset}
        vncUrl={vncUrl}
        relayUrl={relayUrl}
        tabIntervalMs={tabInterval}
        missionName={missionName}
      />
    </div>
  );
}
