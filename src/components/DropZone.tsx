"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DropZoneProps {
  onFileLoaded: (content: string, filename: string) => void;
}

export default function DropZone({ onFileLoaded }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileLoaded(content, file.name);
        setIsLoading(false);
      };
      reader.onerror = () => setIsLoading(false);
      reader.readAsText(file);
    },
    [onFileLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Logo + Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <img src="/logo.svg" alt="AgentReel" className="w-10 h-10 rounded-xl" />
          <h1 className="text-4xl font-bold tracking-tight">
            Agent<span className="text-[var(--accent-blue)]">Reel</span>
          </h1>
        </div>
        <p className="text-[var(--text-secondary)] text-lg max-w-md">
          Watch AI agents work in real-time.
          <br />
          Replays, highlights, and the fails nobody talks about.
        </p>
      </motion.div>

      {/* Drop Zone */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className={`
          relative w-full max-w-2xl aspect-[2/1] rounded-2xl border-2 border-dashed
          flex flex-col items-center justify-center gap-4 cursor-pointer
          transition-all duration-300 group
          ${
            isDragging
              ? "drop-zone-active border-[var(--accent-cyan)] bg-[var(--accent-blue)]/5"
              : "border-[var(--border)] hover:border-[var(--accent-blue)]/50 hover:bg-[var(--bg-secondary)]"
          }
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".jsonl,.json,.txt"
          className="hidden"
          onChange={handleFileInput}
        />

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent animate-spin" />
              <span className="text-[var(--text-secondary)]">
                Parsing transcript...
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="text-4xl opacity-40 group-hover:opacity-60 transition-opacity">
                {isDragging ? "📥" : "📄"}
              </div>
              <div className="text-center">
                <p className="text-[var(--text-primary)] font-medium">
                  {isDragging
                    ? "Drop your transcript here"
                    : "Drop OpenClaw JSONL here"}
                </p>
                <p className="text-[var(--text-muted)] text-sm mt-1">
                  or click to browse files
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Try Demo + Supported formats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 flex flex-col items-center gap-4"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsLoading(true);
            fetch("/demo.jsonl")
              .then((r) => r.text())
              .then((content) => {
                onFileLoaded(content, "demo.jsonl");
                setIsLoading(false);
              })
              .catch(() => setIsLoading(false));
          }}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-white font-medium text-sm hover:opacity-90 transition-opacity shadow-lg shadow-[var(--accent-blue)]/20"
        >
          Try with demo transcript
        </button>

        <div className="flex gap-3 text-xs text-[var(--text-muted)]">
          <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)]">
            .jsonl
          </span>
          <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)]">
            OpenClaw transcript
          </span>
          <span className="px-2 py-1 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)]">
            Local only — nothing uploaded
          </span>
        </div>
      </motion.div>
    </div>
  );
}
