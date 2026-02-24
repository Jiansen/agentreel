export type EventType =
  | "session.start"
  | "session.end"
  | "message.user"
  | "message.agent"
  | "tool.request"
  | "tool.result"
  | "error"
  | "intent"
  | "checkpoint"
  | "approval.request"
  | "approval.response";

export interface TimelineEvent {
  seq: number;
  type: EventType;
  timestamp: string;
  agentId?: string;
  data: Record<string, unknown>;
  /** Duration in ms (computed for tool calls from request to result) */
  durationMs?: number;
  /** Raw source object for "view raw" */
  raw: unknown;
}

export interface ToolCallSummary {
  name: string;
  count: number;
  totalDurationMs: number;
  errors: number;
}

export interface SessionSummary {
  title: string;
  startedAt: string;
  endedAt?: string;
  durationMs: number;
  eventCount: number;
  toolCalls: ToolCallSummary[];
  errorCount: number;
  model?: string;
  totalTokens?: number;
  totalCostUsd?: number;
}

export interface ParsedSession {
  summary: SessionSummary;
  events: TimelineEvent[];
}
