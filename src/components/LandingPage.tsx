"use client";

import { motion } from "framer-motion";
import Link from "next/link";

interface LandingPageProps {
  variant: "openclaw-replay" | "transcript-viewer";
}

const VARIANTS = {
  "openclaw-replay": {
    title: "OpenClaw Replay Viewer",
    subtitle: "Watch your agent's work, step by step",
    description:
      "See every tool call, message, and decision your OpenClaw agent made — in a beautiful, interactive timeline.",
  },
  "transcript-viewer": {
    title: "OpenClaw Transcript Viewer",
    subtitle: "Browse JSONL sessions visually",
    description:
      "Open any OpenClaw JSONL file and explore the agent's reasoning, tool usage, errors, and costs at a glance.",
  },
};

const FEATURES = [
  {
    icon: "📥",
    title: "Drag & Drop",
    desc: "Just drop your .jsonl file. No upload, no account, no install.",
  },
  {
    icon: "🎬",
    title: "Interactive Timeline",
    desc: "Step through events with playback controls. Filter by type. Search by keyword.",
  },
  {
    icon: "🔗",
    title: "One-Click Sharing",
    desc: "Generate shareable links or standalone HTML files. Data stays in the URL — no server needed.",
  },
  {
    icon: "📊",
    title: "Session Insights",
    desc: "See total tokens, cost, duration, tool call stats, and errors at a glance.",
  },
  {
    icon: "🔒",
    title: "Privacy First",
    desc: "Everything runs in your browser. Your transcript data never leaves your machine.",
  },
  {
    icon: "🌙",
    title: "Beautiful Dark Theme",
    desc: "Designed for developers. Color-coded events, smooth animations, zero visual noise.",
  },
];

export default function LandingPage({ variant }: LandingPageProps) {
  const v = VARIANTS[variant];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <img src="/logo.svg" alt="AgentReel" className="w-12 h-12 rounded-xl" />
            <h1 className="text-5xl font-bold tracking-tight">
              Agent<span className="text-[var(--accent-blue)]">Reel</span>
            </h1>
          </div>

          <h2 className="text-2xl font-semibold mb-3 text-[var(--text-primary)]">
            {v.title}
          </h2>
          <p className="text-lg text-[var(--accent-cyan)] mb-4">
            {v.subtitle}
          </p>
          <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto mb-8">
            {v.description}
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[var(--accent-blue)]/20"
            >
              Open Viewer
            </Link>
            <Link
              href="/?demo"
              className="px-6 py-3 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Try Demo
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * i }}
              className="p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent-blue)]/30 transition-colors"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">
                {f.title}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center px-6 pb-20">
        <h2 className="text-2xl font-bold mb-4">
          Built for the{" "}
          <a
            href="https://github.com/anthropics/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-blue)] hover:underline"
          >
            OpenClaw
          </a>{" "}
          community
        </h2>
        <p className="text-[var(--text-secondary)] mb-6 max-w-lg mx-auto">
          Free and open-source. Works entirely in your browser. Your data stays
          on your machine.
        </p>
        <a
          href="https://github.com/Jiansen/agentreel"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-secondary)] transition-colors"
        >
          View on GitHub
        </a>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-[var(--text-muted)] border-t border-[var(--border)]">
        <p>
          AgentReel — Open-source replay viewer for AI agent sessions
          <br />
          <a
            href="https://x.com/agent_reel"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-blue)] hover:underline"
          >
            @agent_reel
          </a>
          {" · "}
          <a
            href="https://x.com/he_jiansen"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            by @he_jiansen
          </a>
        </p>
      </footer>
    </div>
  );
}
