"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

interface LiveStatus {
  youtube: { live: boolean; url?: string; title?: string };
  twitch: { live: boolean; url?: string; title?: string };
}

export default function LandingPage() {
  const router = useRouter();
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Preserve backward compatibility: ?demo and #d= redirect to /replay
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
  }, [router]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          const encoded = btoa(
            encodeURIComponent(content).replace(
              /%([0-9A-F]{2})/g,
              (_, p1) => String.fromCharCode(parseInt(p1, 16))
            )
          );
          sessionStorage.setItem("agentreel_drop", content);
          sessionStorage.setItem("agentreel_drop_name", file.name);
          router.push("/replay");
        };
        reader.readAsText(file);
      }
    },
    [router]
  );

  const isLive =
    liveStatus &&
    (liveStatus.youtube.live || liveStatus.twitch.live);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
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
          <p className="text-[var(--text-secondary)] text-lg max-w-lg">
            Watch AI agents work in real-time.
            <br />
            Replays, highlights, and the fails nobody talks about.
          </p>
        </motion.div>

        {/* Live Now Banner */}
        {isLive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 w-full max-w-md"
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
                    <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.5 6.19a3 3 0 0 0-2.11-2.12C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.39.57A3 3 0 0 0 .5 6.19 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.81 3 3 0 0 0 2.11 2.12c1.89.57 9.39.57 9.39.57s7.5 0 9.39-.57a3 3 0 0 0 2.11-2.12A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
                    </svg>
                    <span className="text-sm text-[var(--text-primary)]">
                      YouTube
                    </span>
                    {liveStatus.youtube.title && (
                      <span className="text-xs text-[var(--text-muted)] truncate">
                        — {liveStatus.youtube.title}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-[var(--text-muted)]">
                      →
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
                    <svg className="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2 3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.71V3.43h11.43Z" />
                    </svg>
                    <span className="text-sm text-[var(--text-primary)]">
                      Twitch
                    </span>
                    {liveStatus.twitch.title && (
                      <span className="text-xs text-[var(--text-muted)] truncate">
                        — {liveStatus.twitch.title}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-[var(--text-muted)]">
                      →
                    </span>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Drop Zone (compact) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`
            relative w-full max-w-md aspect-[5/2] rounded-xl border-2 border-dashed
            flex flex-col items-center justify-center gap-2 cursor-pointer
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
          <div className="text-2xl opacity-40 group-hover:opacity-60 transition-opacity">
            {isDragging ? "📥" : "📄"}
          </div>
          <p className="text-[var(--text-primary)] font-medium text-sm">
            {isDragging ? "Drop to replay" : "Drop JSONL to replay a session"}
          </p>
          <p className="text-[var(--text-muted)] text-xs">
            or click to open the replay viewer
          </p>
        </motion.div>

        {/* Demo + Install CTAs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 flex flex-col items-center gap-4"
        >
          <div className="flex gap-3">
            <a
              href="/replay?demo"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white font-medium text-sm hover:opacity-90 transition-opacity shadow-lg shadow-[var(--accent-blue)]/20"
            >
              Try Demo
            </a>
            <a
              href="https://github.com/Jiansen/agentreel#quick-start"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] font-medium text-sm hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Install →
            </a>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
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
          <span>·</span>
          <a
            href="https://x.com/agent_reel"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            Twitter
          </a>
          <span>·</span>
          <a
            href="https://www.youtube.com/@agentreel"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            YouTube
          </a>
          <span>·</span>
          <a
            href="https://www.twitch.tv/jiansenhe"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            Twitch
          </a>
          <span>·</span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
}
