export type FormatTagType =
  | "thinking"
  | "discovery"
  | "challenge"
  | "browse"
  | "output"
  | "message_in"
  | "message_out"
  | "summary";

export interface PlanStep {
  index: number;
  total: number;
  label: string;
  status: "pending" | "active" | "done";
  substeps?: SubStep[];
}

export interface SubStep {
  label: string;
  status: "pending" | "active" | "done";
}

export interface BroadcastPlan {
  steps: PlanStep[];
  completedCount: number;
  totalCount: number;
}

export interface FormatTagEvent {
  type: FormatTagType;
  text: string;
  timestamp: string;
  meta?: Record<string, string>;
}

export interface OutputItem {
  type: "report" | "screenshot" | "message" | "file";
  description: string;
  destination?: string;
  status: "done" | "pending";
  size?: string;
  timestamp: string;
  readBy?: number;
}

export interface MessageItem {
  direction: "in" | "out";
  sender: string;
  text: string;
  timestamp: string;
  read: boolean;
  readBy?: number;
}

export interface BroadcastSummary {
  completedSteps: number;
  totalSteps: number;
  duration?: string;
  outputs: string[];
  keyFinding?: string;
}

export interface BroadcastData {
  plan: BroadcastPlan | null;
  events: FormatTagEvent[];
  outputs: OutputItem[];
  messages: MessageItem[];
  summary: BroadcastSummary | null;
  missionName: string;
  isLive: boolean;
  elapsedMs: number;
}

export type BroadcastPreset = "landscape" | "portrait";
