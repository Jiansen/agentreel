"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { ShowcaseEntry } from "./api/showcase/route";

interface LiveStatus {
  youtube: { live: boolean; url?: string; title?: string };
  twitch: { live: boolean; url?: string; title?: string };
}

const INSTALL_MSG =
  "Read https://raw.githubusercontent.com/Jiansen/agentreel/main/AGENT_INSTALL.md and follow every step. Tell me when you start and report the result when done.";
const SHOWCASE_SUBMIT_URL =
  "https://github.com/Jiansen/agentreel/issues/new?template=showcase.yml";
const SHOWCASE_REPORT_URL =
  "https://github.com/Jiansen/agentreel/issues/new?template=report-showcase.yml";

export default function HomePage() {
  const router = useRouter();
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [showcases, setShowcases] = useState<ShowcaseEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    if (hash.startsWith("#d=") || params.has("demo") || params.has("url")) {
      router.replace(`/replay${window.location.search}${window.location.hash}`);
      return;
    }

    fetch("/api/live-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setLiveStatus(data);
      })
      .catch(() => {});

    fetch("/api/showcase")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setShowcases(data))
      .catch(() => {});
  }, [router]);

  const copyInstallMsg = useCallback(() => {
    navigator.clipboard.writeText(INSTALL_MSG).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          sessionStorage.setItem("agentreel_drop", reader.result as string);
          sessionStorage.setItem("agentreel_drop_name", file.name);
          router.push("/replay");
        };
        reader.readAsText(file);
      }
    },
    [router]
  );

  const isLive =
    liveStatus && (liveStatus.youtube.live || liveStatus.twitch.live);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col items-center p-8 pt-16 md:pt-24">
        {/* ─── Hero ─── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <img
              src="/logo.svg"
              alt="AgentReel"
              className="w-10 h-10 rounded-xl"
            />
            <h1 className="text-4xl font-bold tracking-tight">
              Agent<span className="text-[var(--accent-blue)]">Reel</span>
            </h1>
          </div>
          <p className="text-[var(--text-secondary)] text-lg max-w-lg leading-relaxed">
            Send one message to your AI agent.
            <br />
            It installs itself. Then watch it work&nbsp;&mdash;&nbsp;live.
          </p>
        </motion.div>

        {/* ─── Primary CTA: Tell Your Agent ─── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-lg mb-4"
        >
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              Tell your AI agent
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm font-mono select-all break-all">
                {INSTALL_MSG}
              </code>
              <button
                onClick={copyInstallMsg}
                className="shrink-0 px-3 py-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
                title="Copy to clipboard"
              >
                {copied ? "✓" : "📋"}
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Copy this. Paste it to your AI agent (OpenClaw, Cursor, Claude
              Code, etc). It does the rest.
            </p>
          </div>
        </motion.div>

        {/* ─── How It Works ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-lg mb-10"
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              {
                step: "1",
                label: "Tell your agent",
                detail: "One message",
              },
              {
                step: "2",
                label: "It installs itself",
                detail: "~1 min",
              },
              {
                step: "3",
                label: "Watch it work",
                detail: "localhost:3000/live",
              },
            ].map(({ step, label, detail }) => (
              <div key={step} className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-sm font-medium">
                  {step}
                </div>
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  {label}
                </p>
                <code className="text-[10px] text-[var(--accent-cyan)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded">
                  {detail}
                </code>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Live Now Banner ─── */}
        {isLive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 w-full max-w-lg"
          >
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-red-400 font-semibold text-sm uppercase tracking-wider">
                  Live Now
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {liveStatus?.youtube.live && (
                  <a
                    href={liveStatus.youtube.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <svg
                      className="w-4 h-4 text-red-500"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M23.5 6.19a3 3 0 0 0-2.11-2.12C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.39.57A3 3 0 0 0 .5 6.19 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.81 3 3 0 0 0 2.11 2.12c1.89.57 9.39.57 9.39.57s7.5 0 9.39-.57a3 3 0 0 0 2.11-2.12A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
                    </svg>
                    <span className="text-sm text-[var(--text-primary)]">
                      YouTube
                    </span>
                    {liveStatus.youtube.title && (
                      <span className="text-xs text-[var(--text-muted)] truncate">
                        &mdash; {liveStatus.youtube.title}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-[var(--text-muted)]">
                      &rarr;
                    </span>
                  </a>
                )}
                {liveStatus?.twitch.live && (
                  <a
                    href={liveStatus.twitch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <svg
                      className="w-4 h-4 text-purple-500"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2 3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.71V3.43h11.43Z" />
                    </svg>
                    <span className="text-sm text-[var(--text-primary)]">
                      Twitch
                    </span>
                    {liveStatus.twitch.title && (
                      <span className="text-xs text-[var(--text-muted)] truncate">
                        &mdash; {liveStatus.twitch.title}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-[var(--text-muted)]">
                      &rarr;
                    </span>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Community Showcases ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-lg mb-10"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Community Showcases
            </h2>
            <a
              href={SHOWCASE_SUBMIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent-blue)] hover:underline"
            >
              Share yours &rarr;
            </a>
          </div>

          {showcases.length > 0 ? (
            <div className="grid gap-3">
              {showcases.map((s) => (
                <ShowcaseCard key={s.id} entry={s} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
              <p className="text-sm text-[var(--text-muted)] mb-1">
                No showcases yet &mdash; be the first!
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Install AgentReel, set up your agent, and{" "}
                <a
                  href={SHOWCASE_SUBMIT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent-blue)] hover:underline"
                >
                  share what it does
                </a>
                .
              </p>
            </div>
          )}
        </motion.div>

        {/* ─── What You See ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-lg mb-10"
        >
          <h2 className="text-center text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            What you see
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {(
              [
                ["🌐", "Agent Browser", "Watch your agent navigate the web"],
                ["📝", "Tool Calls", "See every action as it happens"],
                ["🧠", "Reasoning", "Follow the agent's thinking process"],
                ["📊", "Task Progress", "Track steps, discoveries, outputs"],
              ] as const
            ).map(([icon, title, desc]) => (
              <div
                key={title}
                className="flex items-start gap-2 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]"
              >
                <span className="text-base">{icon}</span>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">
                    {title}
                  </p>
                  <p className="text-[var(--text-muted)]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Already Have a Transcript? (demoted) ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-lg mb-6"
        >
          <div
            className={`
              relative rounded-xl border-2 border-dashed p-5
              flex flex-col items-center gap-2 cursor-pointer
              transition-all duration-300 group
              ${
                isDragging
                  ? "border-[var(--accent-cyan)] bg-[var(--accent-blue)]/5"
                  : "border-[var(--border)] hover:border-[var(--accent-blue)]/50 hover:bg-[var(--bg-secondary)]"
              }
            `}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => router.push("/replay")}
          >
            <p className="text-sm text-[var(--text-secondary)]">
              {isDragging
                ? "📥 Drop to replay"
                : "Already have a session file?"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Drop JSONL here or{" "}
              <a
                href="/replay?demo"
                onClick={(e) => e.stopPropagation()}
                className="text-[var(--accent-blue)] hover:underline"
              >
                try the demo
              </a>
            </p>
          </div>
        </motion.div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="py-6 px-8 border-t border-[var(--border)]">
        <div className="max-w-md mx-auto flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
          <a
            href="https://github.com/Jiansen/agentreel"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            GitHub
          </a>
          <span>&middot;</span>
          <a
            href="https://x.com/agent_reel"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            Twitter
          </a>
          <span>&middot;</span>
          <a
            href="https://www.youtube.com/@agentreel"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            YouTube
          </a>
          <span>&middot;</span>
          <a
            href="https://www.twitch.tv/jiansenhe"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            Twitch
          </a>
          <span>&middot;</span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
}

/* ─── Showcase Card ─── */

function ShowcaseCard({ entry }: { entry: ShowcaseEntry }) {
  return (
    <a
      href={entry.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden hover:border-[var(--accent-blue)]/50 transition-colors"
    >
      {/* 16:9 Thumbnail */}
      {entry.screenshotUrl ? (
        <div className="relative aspect-video bg-[var(--bg-tertiary)] overflow-hidden">
          <img
            src={entry.screenshotUrl}
            alt={entry.title}
            className="w-full h-full object-cover"
          />
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white ml-0.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          {entry.pinned && (
            <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-blue)] text-white font-semibold">
              Official
            </span>
          )}
        </div>
      ) : (
        <div className="aspect-video bg-[var(--bg-tertiary)] flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[var(--text-muted)] opacity-30"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M23.5 6.19a3 3 0 0 0-2.11-2.12C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.39.57A3 3 0 0 0 .5 6.19 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.81 3 3 0 0 0 2.11 2.12c1.89.57 9.39.57 9.39.57s7.5 0 9.39-.57a3 3 0 0 0 2.11-2.12A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
          </svg>
          {entry.pinned && (
            <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-blue)] text-white font-semibold">
              Official
            </span>
          )}
        </div>
      )}

      {/* Card body */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm text-[var(--text-primary)] truncate">
                {entry.title}
              </h3>
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border)]">
                {entry.framework}
              </span>
            </div>
          </div>
          <img
            src={entry.avatarUrl}
            alt={entry.author}
            className="w-5 h-5 rounded-full shrink-0"
          />
        </div>
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">
          {entry.description}
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)]">@{entry.author}</span>
          <span
            className="ml-auto text-[var(--text-muted)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            title="Report this showcase"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(
                `${SHOWCASE_REPORT_URL}&title=${encodeURIComponent(
                  `[Report] #${entry.id} ${entry.title}`
                )}`,
                "_blank"
              );
            }}
          >
            ⚑
          </span>
        </div>
      </div>
    </a>
  );
}
