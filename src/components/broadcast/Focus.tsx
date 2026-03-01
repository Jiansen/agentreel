"use client";

import type { BroadcastData } from "@/types/broadcast";
import AgentView from "./AgentView";
import MissionBar from "./MissionBar";
import TodoList from "./TodoList";
import StreamCards from "./StreamCards";

interface FocusProps {
  data: BroadcastData;
  vncUrl: string;
}

export default function Focus({ data, vncUrl }: FocusProps) {
  return (
    <div className="flex flex-col w-full h-full bg-[var(--bg-primary)]">
      {/* Agent Desktop (32%) */}
      <AgentView vncUrl={vncUrl} className="h-[32%] shrink-0" />

      {/* Todo Strip */}
      <TodoList plan={data.plan} compact />

      {/* Mission Bar (compact) */}
      <MissionBar
        missionName={data.missionName}
        elapsedMs={data.elapsedMs}
        isLive={data.isLive}
        compact
      />

      {/* Tab labels (visual only in live) */}
      <div className="flex border-b border-[var(--border)] shrink-0">
        <div className="flex-1 py-1 text-center text-[7px] font-semibold uppercase tracking-wider text-[var(--text-primary)] border-b-2 border-b-[var(--accent-blue)]">
          Stream
        </div>
        <div className="flex-1 py-1 text-center text-[7px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Output
        </div>
        <div className="flex-1 py-1 text-center text-[7px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Messages
        </div>
      </div>

      {/* Stream Cards (main content) */}
      <div className="flex-1 overflow-hidden">
        <StreamCards events={data.events} compact />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-2.5 py-0.5 border-t border-[var(--border)] text-[7px] text-[var(--text-muted)] shrink-0">
        <span className="text-[var(--accent-purple)]">@agent_reel</span>
        <span>AgentReel</span>
      </div>
    </div>
  );
}
