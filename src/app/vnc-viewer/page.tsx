"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VncViewerInner() {
  const params = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<unknown>(null);
  const [status, setStatus] = useState("Connecting...");

  const host = params.get("host") || (typeof window !== "undefined" ? window.location.hostname : "localhost");
  const port = params.get("port") || (typeof window !== "undefined" ? window.location.port || "3000" : "3000");
  const path = params.get("path") || "vnc-ws";

  useEffect(() => {
    if (!containerRef.current) return;

    const wsUrl = `ws://${host}:${port}/${path}`;

    let rfb: { disconnect: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = await (Function('return import("https://esm.sh/@novnc/novnc@1.5.0/core/rfb.js")')() as Promise<any>);
        if (cancelled) return;

        const RFB = mod.default;
        rfb = new RFB(containerRef.current, wsUrl, {});
        rfbRef.current = rfb;

        const r = rfb as Record<string, unknown>;
        r.viewOnly = false;
        r.scaleViewport = true;
        r.resizeSession = false;
        r.showDotCursor = false;

        (rfb as { addEventListener: (e: string, cb: () => void) => void }).addEventListener("connect", () => {
          if (!cancelled) setStatus("");
        });
        (rfb as { addEventListener: (e: string, cb: () => void) => void }).addEventListener("disconnect", () => {
          if (!cancelled) setStatus("Disconnected");
        });
      } catch (err) {
        if (!cancelled) setStatus(`Failed to load VNC client: ${err}`);
      }
    })();

    return () => {
      cancelled = true;
      if (rfb) rfb.disconnect();
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
