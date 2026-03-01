"use client";

import Watermark from "./Watermark";

interface AgentViewProps {
  vncUrl: string;
  className?: string;
  children?: React.ReactNode;
}

export default function AgentView({ vncUrl, className = "", children }: AgentViewProps) {
  return (
    <div className={`relative overflow-hidden bg-[var(--bg-primary)] ${className}`}>
      {vncUrl ? (
        <iframe
          src={vncUrl}
          className="absolute inset-0 w-full h-full border-0"
          allow="clipboard-read; clipboard-write"
          title="Agent Desktop"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0c0c18] via-[#141428] to-[#0c0c18]">
          <div className="text-center text-[#3a3a52]">
            <div className="text-5xl mb-2">🖥️</div>
            <div className="text-sm">Agent Desktop</div>
            <div className="text-xs mt-1 opacity-60">Waiting for VNC connection...</div>
          </div>
        </div>
      )}
      <Watermark />
      {children}
    </div>
  );
}
