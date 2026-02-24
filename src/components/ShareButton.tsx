"use client";

import { useState } from "react";
import { compressForUrl, generateStandaloneHtml } from "@/lib/share";

interface ShareButtonProps {
  jsonlContent: string;
  title: string;
}

export default function ShareButton({ jsonlContent, title }: ShareButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShareLink = () => {
    const compressed = compressForUrl(jsonlContent);
    if (compressed) {
      const url = `${window.location.origin}${window.location.pathname}#d=${compressed}`;
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      handleDownloadHtml();
    }
    setShowMenu(false);
  };

  const handleDownloadHtml = () => {
    const html = generateStandaloneHtml(jsonlContent, title);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 50)}-replay.html`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const handleDownloadJsonl = () => {
    const blob = new Blob([jsonlContent], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 50)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-[var(--accent-blue)]/80 transition-colors"
      >
        {copied ? "✓ Copied!" : "↗ Share"}
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] shadow-2xl overflow-hidden">
            <button
              onClick={handleShareLink}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors text-left"
            >
              <span>🔗</span>
              <div>
                <p className="text-sm text-[var(--text-primary)]">
                  Copy share link
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Embeds data in URL
                </p>
              </div>
            </button>
            <button
              onClick={handleDownloadHtml}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors text-left"
            >
              <span>📄</span>
              <div>
                <p className="text-sm text-[var(--text-primary)]">
                  Download .html
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Standalone replay file
                </p>
              </div>
            </button>
            <button
              onClick={handleDownloadJsonl}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors text-left border-t border-[var(--border)]"
            >
              <span>📋</span>
              <div>
                <p className="text-sm text-[var(--text-primary)]">
                  Download .jsonl
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Raw transcript
                </p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
