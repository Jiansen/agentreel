import type { TimelineEvent } from "@/types/timeline";
import type {
  ActivityStatus,
  BroadcastData,
  BroadcastPlan,
  BroadcastSummary,
  FormatTagEvent,
  MessageItem,
  OutputItem,
  PlanStep,
} from "@/types/broadcast";

const PLAN_RE = /\[PLAN\]\s*\n((?:\d+\..+\n?)+)/;
const STEP_RE = /\[STEP\s+(\d+)\/(\d+)\s+(BEGIN|COMPLETE)\]\s*(.+)/;
const THINKING_RE = /\[THINKING\]\s*([\s\S]+?)(?=\n\[|$)/;
const DISCOVERY_RE = /\[DISCOVERY\]\s*([\s\S]+?)(?=\n\[|$)/;
const CHALLENGE_RE = /\[CHALLENGE\]\s*([\s\S]+?)(?=\n\[|$)/;
const OUTPUT_RE = /\[OUTPUT\s+type=(\w+)\]\s*([\s\S]+?)(?=\n\[|$)/;
const MESSAGE_FROM_RE = /\[MESSAGE\s+from=(.+?)\]\s*([\s\S]+?)(?=\n\[|$)/;
const MESSAGE_RESP_RE = /\[MESSAGE\s+response\]\s*([\s\S]+?)(?=\n\[|$)/;
const SUMMARY_RE = /\[SUMMARY\]\s*\n([\s\S]+?)(?=\n\[|$)/;

function parsePlanBlock(text: string): PlanStep[] {
  const lines = text.trim().split("\n");
  const steps: PlanStep[] = [];
  for (const line of lines) {
    const m = line.match(/^(\d+)\.\s*(.+)/);
    if (m) {
      const idx = parseInt(m[1], 10);
      steps.push({
        index: idx,
        total: lines.length,
        label: m[2].trim(),
        status: "pending",
      });
    }
  }
  for (const s of steps) s.total = steps.length;
  return steps;
}

function parseSummaryBlock(text: string): BroadcastSummary {
  const summary: BroadcastSummary = { completedSteps: 0, totalSteps: 0, outputs: [] };
  for (const line of text.split("\n")) {
    const trimmed = line.replace(/^-\s*/, "").trim();
    const completedM = trimmed.match(/Completed:\s*(\d+)\s*of\s*(\d+)/i);
    if (completedM) {
      summary.completedSteps = parseInt(completedM[1], 10);
      summary.totalSteps = parseInt(completedM[2], 10);
    }
    const durationM = trimmed.match(/Duration:\s*(.+)/i);
    if (durationM) summary.duration = durationM[1].trim();
    const outputsM = trimmed.match(/Outputs:\s*(.+)/i);
    if (outputsM) summary.outputs = outputsM[1].split(",").map((s) => s.trim());
    const findingM = trimmed.match(/Key finding:\s*(.+)/i);
    if (findingM) summary.keyFinding = findingM[1].trim();
  }
  return summary;
}

function parseOutputMeta(text: string): { destination?: string; size?: string } {
  const dest = text.match(/→\s*(.+?)(?:\s*\(|$)/);
  const size = text.match(/\(([^)]+)\)\s*$/);
  return {
    destination: dest?.[1]?.trim(),
    size: size?.[1]?.trim(),
  };
}

/**
 * Extract structured broadcast data from TimelineEvent[].
 * Looks for [PLAN], [STEP], [THINKING], etc. format tags in agent messages.
 * Falls back to heuristic mapping from raw events when no tags are present.
 */
export function extractBroadcastData(
  events: TimelineEvent[],
  options?: { missionName?: string }
): BroadcastData {
  const plan: BroadcastPlan = { steps: [], completedCount: 0, totalCount: 0 };
  const tagEvents: FormatTagEvent[] = [];
  const outputs: OutputItem[] = [];
  const messages: MessageItem[] = [];
  let summary: BroadcastSummary | null = null;
  let hasFormatTags = false;

  const startEvent = events.find((e) => e.type === "session.start");
  const endEvent = events.findLast((e) => e.type === "session.end");
  const startTime = startEvent ? new Date(startEvent.timestamp).getTime() : Date.now();
  const endTime = endEvent ? new Date(endEvent.timestamp).getTime() : Date.now();

  for (const ev of events) {
    const text = String(ev.data.content ?? "");
    const ts = ev.timestamp;

    if (ev.type === "message.agent" && text) {
      // [PLAN]
      const planMatch = text.match(PLAN_RE);
      if (planMatch) {
        hasFormatTags = true;
        const steps = parsePlanBlock(planMatch[1]);
        plan.steps = steps;
        plan.totalCount = steps.length;
      }

      // [STEP X/N BEGIN|COMPLETE]
      const stepMatches = text.matchAll(new RegExp(STEP_RE, "g"));
      for (const sm of stepMatches) {
        hasFormatTags = true;
        const idx = parseInt(sm[1], 10);
        const action = sm[3];
        const step = plan.steps.find((s) => s.index === idx);
        if (step) {
          step.status = action === "COMPLETE" ? "done" : "active";
          if (action === "COMPLETE") {
            plan.completedCount = plan.steps.filter((s) => s.status === "done").length;
          }
        }
      }

      // [THINKING]
      const thinkMatch = text.match(THINKING_RE);
      if (thinkMatch) {
        hasFormatTags = true;
        tagEvents.push({ type: "thinking", text: thinkMatch[1].trim(), timestamp: ts });
      }

      // [DISCOVERY]
      const discMatch = text.match(DISCOVERY_RE);
      if (discMatch) {
        hasFormatTags = true;
        tagEvents.push({ type: "discovery", text: discMatch[1].trim(), timestamp: ts });
      }

      // [CHALLENGE]
      const chalMatch = text.match(CHALLENGE_RE);
      if (chalMatch) {
        hasFormatTags = true;
        tagEvents.push({ type: "challenge", text: chalMatch[1].trim(), timestamp: ts });
      }

      // [OUTPUT type=X]
      const outMatch = text.match(OUTPUT_RE);
      if (outMatch) {
        hasFormatTags = true;
        const outputType = outMatch[1] as OutputItem["type"];
        const desc = outMatch[2].trim();
        const { destination, size } = parseOutputMeta(desc);
        const item: OutputItem = {
          type: ["report", "screenshot", "message", "file"].includes(outputType)
            ? outputType
            : "file",
          description: desc.split("→")[0].trim(),
          destination,
          size,
          status: "done",
          timestamp: ts,
        };
        outputs.push(item);
        tagEvents.push({
          type: "output",
          text: desc,
          timestamp: ts,
          meta: { outputType, destination: destination ?? "" },
        });
      }

      // [MESSAGE from=X]
      const msgFromMatch = text.match(MESSAGE_FROM_RE);
      if (msgFromMatch) {
        hasFormatTags = true;
        const sender = msgFromMatch[1].trim();
        const msgText = msgFromMatch[2].trim().replace(/^["']|["']$/g, "");
        messages.push({ direction: "in", sender, text: msgText, timestamp: ts, read: true });
        tagEvents.push({
          type: "message_in",
          text: `${sender}: ${msgText}`,
          timestamp: ts,
          meta: { sender },
        });
      }

      // [MESSAGE response]
      const msgRespMatch = text.match(MESSAGE_RESP_RE);
      if (msgRespMatch) {
        hasFormatTags = true;
        const respText = msgRespMatch[1].trim();
        messages.push({ direction: "out", sender: "Agent", text: respText, timestamp: ts, read: false });
        tagEvents.push({ type: "message_out", text: respText, timestamp: ts });
      }

      // [SUMMARY]
      const sumMatch = text.match(SUMMARY_RE);
      if (sumMatch) {
        hasFormatTags = true;
        summary = parseSummaryBlock(sumMatch[1]);
      }
    }

    // Capture incoming user messages as external messages
    if (ev.type === "message.user" && text) {
      const isFormatInstruction = text.includes("FORMAT REQUIREMENTS") || text.includes("[PLAN]");
      if (!isFormatInstruction) {
        messages.push({ direction: "in", sender: "User", text: text.slice(0, 200), timestamp: ts, read: true });
        tagEvents.push({ type: "message_in", text: text.slice(0, 200), timestamp: ts, meta: { sender: "User" } });
      }
    }
  }

  // Fallback: if no format tags found, map raw events to broadcast events
  if (!hasFormatTags) {
    for (const ev of events) {
      const text = String(ev.data.content ?? "");
      const ts = ev.timestamp;

      if (ev.type === "message.agent" && text) {
        const isThinking = text.startsWith("*Thinking:*");
        tagEvents.push({
          type: isThinking ? "thinking" : "discovery",
          text: isThinking ? text.replace("*Thinking:*", "").trim() : text.slice(0, 300),
          timestamp: ts,
        });
      }
      if (ev.type === "tool.request") {
        const toolName = String(ev.data.tool_name ?? "tool");
        tagEvents.push({ type: "browse", text: `Using ${toolName}`, timestamp: ts });
      }
      if (ev.type === "error") {
        tagEvents.push({
          type: "challenge",
          text: String(ev.data.message ?? "Error encountered"),
          timestamp: ts,
        });
      }
    }
  }

  const missionName =
    options?.missionName ??
    (events.find((e) => e.type === "message.user")?.data.content as string)?.slice(0, 60) ??
    "Agent Session";

  const lastTag = tagEvents[tagEvents.length - 1];
  let activityStatus: ActivityStatus = "idle";
  if (summary) {
    activityStatus = "completed";
  } else if (lastTag) {
    const typeMap: Record<string, ActivityStatus> = {
      thinking: "thinking",
      discovery: "analyzing",
      challenge: "analyzing",
      browse: "browsing",
      output: "writing",
      message_out: "writing",
      message_in: "idle",
      summary: "completed",
    };
    activityStatus = typeMap[lastTag.type] ?? "idle";
  }

  return {
    plan: plan.steps.length > 0 ? plan : null,
    events: tagEvents,
    outputs,
    messages,
    summary,
    missionName,
    isLive: !endEvent || endEvent.type !== "session.end",
    elapsedMs: endTime - startTime,
    activityStatus,
    lastEventTime: lastTag?.timestamp ?? null,
  };
}
