import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import BroadcastClient from "../live/BroadcastClient";

export const metadata: Metadata = {
  title: "AgentReel Broadcast — Kiosk Mode",
  robots: "noindex, nofollow",
};

/**
 * Dedicated kiosk page for ffmpeg/OBS capture.
 * Unlike /live, this page does NOT embed a VNC iframe — because the
 * Chromium loading this page IS the desktop being captured.
 * Query params: relay, preset, tabInterval, mission (same as /live, minus vnc).
 */
export default function BroadcastPage() {
  if (process.env.VERCEL === "1") {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">
          Loading broadcast...
        </div>
      }
    >
      <BroadcastClient />
    </Suspense>
  );
}
