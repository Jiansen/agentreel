import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import SettingsFloat from "@/components/SettingsFloat";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentReel — Watch AI Agents Work in Real-Time",
  description:
    "Install in 3 minutes. Give your AI agent a task. Watch it work live — tool calls, reasoning, and results streaming in real-time.",
  keywords: [
    "AI agent",
    "live viewer",
    "OpenClaw",
    "agent streaming",
    "real-time",
    "JSONL viewer",
    "agent session replay",
  ],
  metadataBase: new URL("https://agentreel.agent-status.com"),
  openGraph: {
    title: "AgentReel — Watch AI Agents Work in Real-Time",
    description:
      "Install. Give your agent a task. Watch it work live. Tool calls, browsing, reasoning — all streaming in real-time.",
    type: "website",
    siteName: "AgentReel",
    url: "https://agentreel.agent-status.com",
    images: [
      {
        url: "/og-image.png",
        width: 1280,
        height: 640,
        alt: "AgentReel — Watch AI Agents Work in Real-Time",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@agent_reel",
    creator: "@he_jiansen",
    title: "AgentReel — Watch AI Agents Work in Real-Time",
    description:
      "Install in 3 minutes. Give your agent a task. Watch it work live.",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/logo-512.png",
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
      <body className="antialiased">
        {children}
        {process.env.VERCEL !== "1" && <SettingsFloat />}
        {process.env.VERCEL === "1" && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
