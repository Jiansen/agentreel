import type { Metadata } from "next";
import LandingPage from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "OpenClaw Transcript Viewer — Browse JSONL Sessions Visually",
  description:
    "Open and explore OpenClaw JSONL transcript files in a beautiful visual timeline. See tool calls, errors, agent reasoning, and costs at a glance. Zero install required.",
  keywords: [
    "OpenClaw transcript viewer",
    "JSONL viewer",
    "OpenClaw session browser",
    "AI agent transcript",
    "OpenClaw logs viewer",
  ],
  openGraph: {
    title: "OpenClaw Transcript Viewer — Browse JSONL Sessions Visually",
    description:
      "Open OpenClaw JSONL files in a visual timeline. Zero install, privacy-first.",
    type: "website",
  },
  alternates: {
    canonical: "https://agentreel.agent-status.com/openclaw-transcript-viewer",
  },
};

export default function TranscriptViewerPage() {
  return <LandingPage variant="transcript-viewer" />;
}
