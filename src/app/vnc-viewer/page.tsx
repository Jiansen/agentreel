"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VncViewerInner() {
  const params = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Connecting...");

  const host = params.get("host") || (typeof window !== "undefined" ? window.location.hostname : "localhost");
  const port = params.get("port") || (typeof window !== "undefined" ? window.location.port || "3000" : "3000");
  const path = params.get("path") || "vnc-ws";

  useEffect(() => {
    if (!containerRef.current) return;

    const wsUrl = `ws://${host}:${port}/${path}`;
    let cancelled = false;
    let rfb: import("@novnc/novnc/lib/rfb.js").default | null = null;

    (async () => {
      try {
        const { default: RFB } = await import("@novnc/novnc/lib/rfb.js");
        if (cancelled) return;

        rfb = new RFB(containerRef.current!, wsUrl, {});
        rfb.viewOnly = false;
        rfb.scaleViewport = true;
        rfb.resizeSession = false;
        rfb.showDotCursor = false;

        rfb.addEventListener("connect", () => { if (!cancelled) setStatus(""); });
        rfb.addEventListener("disconnect", () => { if (!cancelled) setStatus("Disconnected"); });
      } catch (err) {
        if (!cancelled) setStatus(`VNC client error: ${err}`);
      }
    })();

    return () => {
      cancelled = true;
      try { rfb?.disconnect(); } catch { /* ignore */ }
    };
  }, [host, port, path]);

  return (
    <div style={{ width: "100vw", height: "100vh", margin: 0, padding: 0, overflow: "hidden", background: "#000" }}>
      {status && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#666", fontSize: "14px" }}>
          {status}
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

export default function VncViewerPage() {
  return (
    <Suspense fallback={<div style={{ background: "#000", width: "100vw", height: "100vh" }} />}>
      <VncViewerInner />
    </Suspense>
  );
}
