import type { Metadata } from "next";
import LiveViewer from "@/components/LiveViewer";

export const metadata: Metadata = {
  title: "AgentReel Live — Watch AI Agents Work in Real-Time",
  description:
    "Live stream of AI agent sessions. Watch tool calls, reasoning, and results appear in real-time.",
  openGraph: {
    title: "AgentReel Live — Watch AI Agents Work in Real-Time",
    description: "Real-time AI agent session viewer. Watch the agent think and act.",
  },
};

export default function LivePage() {
  return <LiveViewer />;
}
