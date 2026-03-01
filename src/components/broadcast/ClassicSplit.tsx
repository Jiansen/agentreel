"use client";

import type { BroadcastData } from "@/types/broadcast";
import AgentView from "./AgentView";
import MissionBar from "./MissionBar";
import TodoList from "./TodoList";
import StreamCards from "./StreamCards";
import OutputPanel from "./OutputPanel";
import MessagePanel from "./MessagePanel";
import TabCycler from "./TabCycler";

interface ClassicSplitProps {
  data: BroadcastData;
  vncUrl: string;
  tabIntervalMs?: number;
}

export default function ClassicSplit({ data, vncUrl, tabIntervalMs = 10000 }: ClassicSplitProps) {
  const tabs = [
    { label: "Stream", content: <StreamCards events={data.events} /> },
    { label: "Output", content: <OutputPanel outputs={data.outputs} /> },
    { label: "Messages", content: <MessagePanel messages={data.messages} /> },
  ];

  return (
    <div className="flex w-full h-full bg-[var(--bg-primary)]">
      {/* Left: Mission + Agent + Todo (70%) */}
      <div className="w-[70%] flex flex-col">
        <MissionBar
          missionName={data.missionName}
          elapsedMs={data.elapsedMs}
          isLive={data.isLive}
        />
        <AgentView vncUrl={vncUrl} className="flex-1" />
        <div className="h-[132px] shrink-0">
          <TodoList plan={data.plan} />
        </div>
      </div>

      {/* Right: Sidebar (30%) */}
      <div className="w-[30%] flex flex-col bg-[var(--bg-secondary)] border-l border-[var(--border)]">
        <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-[var(--border)] shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-red)] animate-pulse" />
          <span className="text-[9px] font-bold text-[var(--accent-red)] uppercase tracking-widest">Live</span>
          <span className="text-[11px] font-bold text-[var(--text-muted)] ml-auto">AgentReel</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <TabCycler tabs={tabs} intervalMs={tabIntervalMs} />
        </div>
        <div className="flex items-center justify-between px-2.5 py-1 border-t border-[var(--border)] text-[8px] text-[var(--text-muted)] shrink-0">
          <span className="text-[var(--accent-purple)]">@agent_reel</span>
          <span>agentreel.agent-status.com</span>
        </div>
      </div>
    </div>
  );
}
