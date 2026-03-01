import type { Metadata } from "next";
import { Suspense } from "react";
import BroadcastClient from "./BroadcastClient";

export const metadata: Metadata = {
  title: "AgentReel Broadcast",
  description: "Livestream broadcast view for AgentReel — captured by ffmpeg for streaming.",
  robots: "noindex",
};

export default function BroadcastPage() {
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
