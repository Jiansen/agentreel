import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentReel — Beautiful Replay Viewer for AI Agent Sessions",
  description:
    "Drag & drop your OpenClaw JSONL transcript to instantly replay, explore, and share your AI agent's work. Zero install, zero config.",
  keywords: [
    "OpenClaw",
    "replay viewer",
    "AI agent",
    "transcript viewer",
    "JSONL viewer",
    "agent session replay",
  ],
  metadataBase: new URL("https://reels.agent-status.com"),
  openGraph: {
    title: "AgentReel — See Your Agent's Work, Beautifully",
    description:
      "Drag & drop OpenClaw transcripts. Instant timeline replay. One-click sharing.",
    type: "website",
    siteName: "AgentReel",
    url: "https://reels.agent-status.com",
    images: [
      {
        url: "/api/og?title=Beautiful+Replay+Viewer+for+AI+Agent+Sessions",
        width: 1200,
        height: 630,
        alt: "AgentReel — AI Agent Session Replay",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentReel — Beautiful Replay Viewer for AI Agent Sessions",
    description:
      "Drag & drop OpenClaw transcripts. Instant timeline replay. One-click sharing.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
