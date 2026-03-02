"use client";

import type { BroadcastData } from "@/types/broadcast";
import AgentView from "./AgentView";
import AgentTerminal from "./AgentTerminal";
import MissionBar from "./MissionBar";
import TodoList from "./TodoList";
import StreamCards from "./StreamCards";
import OutputPanel from "./OutputPanel";
import MessagePanel from "./MessagePanel";
import TabCycler from "./TabCycler";
import QRFooter from "./QRFooter";
import Watermark from "./Watermark";

interface ClassicSplitProps {
  data: BroadcastData;
  vncUrl: string;
  rawLines?: string[];
  tabIntervalMs?: number;
}

export default function ClassicSplit({ data, vncUrl, rawLines = [], tabIntervalMs = 10000 }: ClassicSplitProps) {
  const tabs = [
    { label: "Stream", content: <StreamCards events={data.events} /> },
    { label: "Output", content: <OutputPanel outputs={data.outputs} /> },
    { label: "Messages", content: <MessagePanel messages={data.messages} /> },
  ];

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

      {/* Right 30%: Mission + TodoList + Tabs (Stream/Output/Messages) + QR */}
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
        <div className="flex-1 overflow-hidden">
          <TabCycler tabs={tabs} intervalMs={tabIntervalMs} />
        </div>
        <QRFooter />
      </div>
    </div>
  );
}
