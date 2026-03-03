import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import BroadcastClient from "./BroadcastClient";

export const metadata: Metadata = {
  title: "AgentReel Live — Watch AI Agents Work in Real-Time",
  description:
    "Live stream of AI agent sessions. Watch tool calls, reasoning, and results appear in real-time.",
  openGraph: {
    title: "AgentReel Live — Watch AI Agents Work in Real-Time",
    description:
      "Real-time AI agent session viewer with desktop capture, task progress, and session history.",
  },
};

export default function LivePage() {
  if (process.env.VERCEL === "1") {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen flex items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">
          Loading live view...
        </div>
      }
    >
      <BroadcastClient />
    </Suspense>
  );
}
