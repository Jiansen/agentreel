"use client";

import type { BroadcastData } from "@/types/broadcast";
import AgentView from "./AgentView";
import AgentTerminal from "./AgentTerminal";
import MissionBar from "./MissionBar";
import TodoList from "./TodoList";
import StreamCards from "./StreamCards";
import QRFooter from "./QRFooter";
import Watermark from "./Watermark";

interface ClassicSplitProps {
  data: BroadcastData;
  vncUrl: string;
  rawLines?: string[];
  tabIntervalMs?: number;
}

export default function ClassicSplit({ data, vncUrl, rawLines = [] }: ClassicSplitProps) {
  return (
    <div className="flex w-full h-full bg-[var(--bg-primary)]">
      {/* Left 70%: Agent Browser (top 65%) + Agent Terminal (bottom 35%) */}
      <div className="w-[70%] flex flex-col relative">
        <AgentView vncUrl={vncUrl} className="h-[65%]" />
        <div className="h-[35%]">
          <AgentTerminal rawLines={rawLines} />
        </div>
        <Watermark />
      </div>

      {/* Right 30%: Mission + TodoList + Stream + QR */}
      <div className="w-[30%] flex flex-col bg-[var(--bg-secondary)] border-l border-[var(--border)]">
        <MissionBar
          missionName={data.missionName}
          elapsedMs={data.elapsedMs}
          isLive={data.isLive}
          activityStatus={data.activityStatus}
        />
        <div className="shrink-0 max-h-[30%] overflow-y-auto">
          <TodoList plan={data.plan} />
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 border-y border-[var(--border)] shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-red)] animate-pulse" />
          <span className="text-[8px] font-bold text-[var(--accent-red)] uppercase tracking-widest">Stream</span>
          <span className="text-[10px] font-bold text-[var(--text-muted)] ml-auto">AgentReel</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <StreamCards events={data.events} />
        </div>
        <QRFooter />
      </div>
    </div>
  );
}
