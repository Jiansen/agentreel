import type { Metadata } from "next";
import LandingPage from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "OpenClaw Replay Viewer — Watch Your Agent's Work Step by Step",
  description:
    "Free, open-source replay viewer for OpenClaw sessions. Drag & drop your JSONL transcript to see a beautiful timeline of every tool call, message, and error. Share with one click.",
  keywords: [
    "OpenClaw replay",
    "OpenClaw viewer",
    "OpenClaw transcript viewer",
    "AI agent replay",
    "OpenClaw JSONL viewer",
    "agent session replay",
  ],
  openGraph: {
    title: "OpenClaw Replay Viewer — Watch Your Agent's Work Step by Step",
    description:
      "Free replay viewer for OpenClaw. Drag & drop JSONL. Beautiful timeline. One-click sharing.",
    type: "website",
  },
  alternates: {
    canonical: "https://agentreel.agent-status.com/openclaw-replay",
  },
};

export default function OpenClawReplayPage() {
  return <LandingPage variant="openclaw-replay" />;
}
