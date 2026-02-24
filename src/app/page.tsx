"use client";

import { useState, useEffect, useCallback } from "react";
import DropZone from "@/components/DropZone";
import Viewer from "@/components/Viewer";
import { parseOpenClawJsonl } from "@/lib/parsers/openclaw";
import { decompressFromUrl } from "@/lib/share";
import type { ParsedSession } from "@/types/timeline";

export default function Home() {
  const [session, setSession] = useState<ParsedSession | null>(null);
  const [jsonlContent, setJsonlContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const loadContent = useCallback((content: string, source: string) => {
    try {
      const parsed = parseOpenClawJsonl(content);
      setSession(parsed);
      setJsonlContent(content);
      setError(null);
      console.log(`[AgentReel] Loaded ${parsed.events.length} events from ${source}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to parse file";
      setError(msg);
      console.error("[AgentReel] Parse error:", msg);
    }
  }, []);

  // Check URL hash for shared data on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#d=")) {
      const encoded = hash.slice(3);
      const content = decompressFromUrl(encoded);
      if (content) {
        loadContent(content, "shared link");
      }
    }
  }, [loadContent]);

  const handleFileLoaded = useCallback(
    (content: string, filename: string) => {
      loadContent(content, filename);
    },
    [loadContent]
  );

  const handleReset = useCallback(() => {
    setSession(null);
    setJsonlContent("");
    setError(null);
    // Clear URL hash
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Parse Error</h2>
          <p className="text-[var(--text-secondary)] mb-6">{error}</p>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:bg-[var(--accent-blue)]/80 transition-colors"
          >
            Try another file
          </button>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <Viewer
        session={session}
        jsonlContent={jsonlContent}
        onReset={handleReset}
      />
    );
  }

  return <DropZone onFileLoaded={handleFileLoaded} />;
}
