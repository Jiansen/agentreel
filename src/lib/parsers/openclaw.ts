import type {
  TimelineEvent,
  ParsedSession,
  SessionSummary,
  ToolCallSummary,
} from "@/types/timeline";

/* ------------------------------------------------------------------ */
/*  OpenClaw v3 JSONL event types                                      */
/* ------------------------------------------------------------------ */

interface V3Line {
  type: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  // v3 session header
  version?: number;
  cwd?: string;
  // v3 model_change
  provider?: string;
  modelId?: string;
  // v3 message wrapper
  message?: V3Message;
  // v3 custom
  customType?: string;
  data?: Record<string, unknown>;
  // Legacy flat format (Anthropic-style)
  role?: string;
  content?: string | ContentBlock[];
  model?: string;
  usage?: Record<string, number>;
  cost_usd?: number;
  duration_ms?: number;
  session_id?: string;
}

interface V3Message {
  role: string;
  content: string | ContentBlock[];
  timestamp?: number;
  api?: string;
  provider?: string;
  model?: string;
  usage?: V3Usage;
  stopReason?: string;
  toolCallId?: string;
  toolName?: string;
  details?: Record<string, unknown>;
  isError?: boolean;
}

interface V3Usage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  cost?: { total?: number };
  // Legacy Anthropic names
  input_tokens?: number;
  output_tokens?: number;
}

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  thinkingSignature?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
  tool_use_id?: string;
  toolCallId?: string;
  toolName?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
  isError?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function tsFromV3(line: V3Line): string {
  return line.timestamp ?? new Date().toISOString();
}

function contentToText(content: string | ContentBlock[] | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .map((b) => {
      if (b.type === "text") return b.text ?? "";
      if (b.type === "thinking") return b.thinking ?? "";
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function isV3Format(lines: V3Line[]): boolean {
  return lines.some(
    (l) =>
      (l.type === "session" && l.version !== undefined) ||
      (l.type === "message" && l.message !== undefined)
  );
}

/* ------------------------------------------------------------------ */
/*  V3 parser (OpenClaw 2024.12+)                                     */
/* ------------------------------------------------------------------ */

function parseV3(lines: V3Line[]): ParsedSession {
  const events: TimelineEvent[] = [];
  let seq = 0;
  const toolTimings = new Map<string, { seq: number; timestamp: string }>();
  let sessionModel: string | undefined;
  let sessionProvider: string | undefined;
  let totalTokens = 0;
  let totalCostUsd = 0;

  for (const line of lines) {
    const ts = tsFromV3(line);

    if (line.type === "session") {
      seq++;
      events.push({
        seq,
        type: "session.start",
        timestamp: ts,
        data: { session_id: line.id, cwd: line.cwd },
        raw: line,
      });
      continue;
    }

    if (line.type === "model_change") {
      sessionModel = line.modelId;
      sessionProvider = line.provider;
      continue;
    }

    if (line.type === "thinking_level_change" || line.type === "custom") {
      continue;
    }

    if (line.type === "message" && line.message) {
      const msg = line.message;
      const role = msg.role;

      if (role === "user") {
        const text = contentToText(msg.content);
        if (text) {
          seq++;
          events.push({
            seq,
            type: "message.user",
            timestamp: ts,
            data: { content: text },
            raw: line,
          });
        }
        continue;
      }

      if (role === "assistant") {
        const blocks: ContentBlock[] = Array.isArray(msg.content)
          ? msg.content
          : typeof msg.content === "string"
            ? [{ type: "text", text: msg.content }]
            : [];

        const textParts: string[] = [];
        const toolCalls: ContentBlock[] = [];

        for (const b of blocks) {
          if (b.type === "text" && b.text) textParts.push(b.text);
          if (b.type === "thinking" && b.thinking)
            textParts.push(`*Thinking:* ${b.thinking}`);
          if (b.type === "toolCall" || b.type === "tool_use")
            toolCalls.push(b);
        }

        // Accumulate usage
        if (msg.usage) {
          const inp = msg.usage.input ?? msg.usage.input_tokens ?? 0;
          const out = msg.usage.output ?? msg.usage.output_tokens ?? 0;
          totalTokens += inp + out;
          if (msg.usage.cost?.total) totalCostUsd += msg.usage.cost.total;
        }

        if (textParts.length > 0) {
          seq++;
          events.push({
            seq,
            type: "message.agent",
            timestamp: ts,
            data: {
              content: textParts.join("\n\n"),
              model: msg.model
                ? `${msg.provider ?? sessionProvider ?? ""}/${msg.model}`
                : sessionModel
                  ? `${sessionProvider ?? ""}/${sessionModel}`
                  : undefined,
              tokens: msg.usage
                ? (msg.usage.input ?? 0) + (msg.usage.output ?? 0)
                : undefined,
            },
            raw: line,
          });
        }

        for (const tc of toolCalls) {
          seq++;
          const toolId = tc.id ?? "";
          const toolName = tc.name ?? "unknown";
          const params = tc.arguments ?? tc.input ?? {};
          events.push({
            seq,
            type: "tool.request",
            timestamp: ts,
            data: {
              tool_name: toolName,
              tool_use_id: toolId,
              parameters: params,
            },
            raw: tc,
          });
          if (toolId) {
            toolTimings.set(toolId, { seq, timestamp: ts });
          }
        }
        continue;
      }

      if (role === "toolResult" || role === "tool_result") {
        const toolCallId = msg.toolCallId ?? "";
        const resultText = contentToText(msg.content);
        const isError =
          msg.isError ??
          (msg.details as Record<string, unknown>)?.isError ??
          false;

        let durationMs: number | undefined;
        const requestInfo = toolTimings.get(toolCallId);
        if (requestInfo) {
          const diff =
            new Date(ts).getTime() - new Date(requestInfo.timestamp).getTime();
          if (diff > 0) durationMs = diff;
        }
        if (!durationMs && msg.details) {
          const d = msg.details as Record<string, unknown>;
          if (typeof d.durationMs === "number") durationMs = d.durationMs;
        }

        seq++;
        events.push({
          seq,
          type: "tool.result",
          timestamp: ts,
          data: {
            tool_use_id: toolCallId,
            tool_name: msg.toolName,
            output: resultText,
            is_error: isError,
            exit_code: (msg.details as Record<string, unknown>)?.exitCode,
          },
          durationMs,
          raw: line,
        });

        if (isError) {
          seq++;
          events.push({
            seq,
            type: "error",
            timestamp: ts,
            data: {
              source: "tool_result",
              tool_use_id: toolCallId,
              message: resultText.slice(0, 500),
            },
            raw: line,
          });
        }
        continue;
      }
    }
  }

  // Session end
  const lastTs = tsFromV3(lines[lines.length - 1]);
  seq++;
  events.push({
    seq,
    type: "session.end",
    timestamp: lastTs,
    data: {},
    raw: { type: "session.end" },
  });

  const summary = buildSummaryFromEvents(events, {
    model: sessionModel
      ? `${sessionProvider ?? ""}/${sessionModel}`
      : undefined,
    totalTokens,
    totalCostUsd,
  });
  return { summary, events };
}

/* ------------------------------------------------------------------ */
/*  Legacy parser (Anthropic flat-message format)                      */
/* ------------------------------------------------------------------ */

function parseLegacy(lines: V3Line[]): ParsedSession {
  const events: TimelineEvent[] = [];
  let seq = 0;
  const toolTimings = new Map<string, { seq: number; timestamp: string }>();

  seq++;
  const firstTs =
    lines[0]?.timestamp ?? new Date(Date.now() - 1000).toISOString();
  events.push({
    seq,
    type: "session.start",
    timestamp: firstTs,
    data: {
      model: lines[0]?.model,
      session_id: lines[0]?.session_id,
    },
    raw: { type: "session.start" },
  });

  for (let i = 0; i < lines.length; i++) {
    const msg = lines[i];
    const ts =
      msg.timestamp ?? new Date(Date.now() - (1000 - i) * 1000).toISOString();

    if (msg.role === "user") {
      const contentBlocks = Array.isArray(msg.content) ? msg.content : [];
      const hasToolResults = contentBlocks.some(
        (b) => b.type === "tool_result"
      );

      if (hasToolResults) {
        for (const block of contentBlocks) {
          if (block.type === "tool_result" && block.tool_use_id) {
            seq++;
            const resultText =
              typeof block.content === "string"
                ? block.content
                : contentToText(block.content as ContentBlock[]);

            let durationMs: number | undefined;
            const requestInfo = toolTimings.get(block.tool_use_id);
            if (requestInfo) {
              const diff =
                new Date(ts).getTime() -
                new Date(requestInfo.timestamp).getTime();
              if (diff > 0) durationMs = diff;
            }

            events.push({
              seq,
              type: "tool.result",
              timestamp: ts,
              data: {
                tool_use_id: block.tool_use_id,
                output: resultText,
                is_error: block.is_error ?? false,
              },
              durationMs,
              raw: block,
            });

            if (block.is_error) {
              seq++;
              events.push({
                seq,
                type: "error",
                timestamp: ts,
                data: {
                  source: "tool_result",
                  tool_use_id: block.tool_use_id,
                  message: resultText.slice(0, 500),
                },
                raw: block,
              });
            }
          }
        }
        continue;
      }

      seq++;
      events.push({
        seq,
        type: "message.user",
        timestamp: ts,
        data: { content: contentToText(msg.content), model: msg.model },
        raw: msg,
      });
      continue;
    }

    if (msg.role === "assistant") {
      const contentBlocks = Array.isArray(msg.content) ? msg.content : [];
      const textParts: string[] = [];
      const toolUses: ContentBlock[] = [];

      for (const block of contentBlocks) {
        if (block.type === "text" && block.text) textParts.push(block.text);
        else if (block.type === "thinking" && block.thinking)
          textParts.push(`*Thinking:* ${block.thinking}`);
        else if (block.type === "tool_use") toolUses.push(block);
      }

      if (typeof msg.content === "string") textParts.push(msg.content);

      if (textParts.length > 0) {
        seq++;
        events.push({
          seq,
          type: "message.agent",
          timestamp: ts,
          data: {
            content: textParts.join("\n\n"),
            model: msg.model,
            tokens: msg.usage
              ? (msg.usage.input_tokens ?? 0) + (msg.usage.output_tokens ?? 0)
              : undefined,
            cost_usd: msg.cost_usd,
            duration_ms: msg.duration_ms,
          },
          raw: msg,
        });
      }

      for (const tool of toolUses) {
        seq++;
        events.push({
          seq,
          type: "tool.request",
          timestamp: ts,
          data: {
            tool_name: tool.name ?? "unknown",
            tool_use_id: tool.id,
            parameters: tool.input ?? {},
          },
          raw: tool,
        });
        if (tool.id) toolTimings.set(tool.id, { seq, timestamp: ts });
      }
      continue;
    }
  }

  const lastTs =
    lines[lines.length - 1]?.timestamp ?? new Date().toISOString();
  seq++;
  events.push({
    seq,
    type: "session.end",
    timestamp: lastTs,
    data: {},
    raw: { type: "session.end" },
  });

  let totalTokens = 0;
  let totalCostUsd = 0;
  for (const m of lines) {
    if (m.usage) {
      totalTokens +=
        (m.usage.input_tokens ?? 0) + (m.usage.output_tokens ?? 0);
    }
    if (m.cost_usd) totalCostUsd += m.cost_usd;
  }

  const summary = buildSummaryFromEvents(events, {
    model: lines.find((m) => m.model)?.model,
    totalTokens,
    totalCostUsd,
  });
  return { summary, events };
}

/* ------------------------------------------------------------------ */
/*  Entry point — auto-detects format                                  */
/* ------------------------------------------------------------------ */

export function parseOpenClawJsonl(raw: string): ParsedSession {
  const lines: V3Line[] = [];
  for (const l of raw.split("\n")) {
    const trimmed = l.trim();
    if (!trimmed) continue;
    try {
      lines.push(JSON.parse(trimmed));
    } catch {
      // skip malformed
    }
  }

  if (lines.length === 0) throw new Error("No valid JSONL messages found");

  return isV3Format(lines) ? parseV3(lines) : parseLegacy(lines);
}

/* ------------------------------------------------------------------ */
/*  Summary builder (shared)                                           */
/* ------------------------------------------------------------------ */

function buildSummaryFromEvents(
  events: TimelineEvent[],
  meta: { model?: string; totalTokens: number; totalCostUsd: number }
): SessionSummary {
  const starts = events.filter((e) => e.type === "session.start");
  const ends = events.filter((e) => e.type === "session.end");
  const toolRequests = events.filter((e) => e.type === "tool.request");
  const toolResults = events.filter((e) => e.type === "tool.result");
  const errors = events.filter((e) => e.type === "error");

  const startTime = starts[0]?.timestamp ?? new Date().toISOString();
  const endTime = ends[ends.length - 1]?.timestamp;
  const durationMs =
    startTime && endTime
      ? new Date(endTime).getTime() - new Date(startTime).getTime()
      : 0;

  const toolMap = new Map<
    string,
    { count: number; totalDurationMs: number; errors: number }
  >();
  for (const req of toolRequests) {
    const name = (req.data.tool_name as string) ?? "unknown";
    const existing = toolMap.get(name) ?? {
      count: 0,
      totalDurationMs: 0,
      errors: 0,
    };
    existing.count++;
    toolMap.set(name, existing);
  }
  for (const res of toolResults) {
    const toolUseId = res.data.tool_use_id as string;
    const matchingReq = toolRequests.find(
      (r) => r.data.tool_use_id === toolUseId
    );
    if (matchingReq) {
      const name = (matchingReq.data.tool_name as string) ?? "unknown";
      const existing = toolMap.get(name);
      if (existing) {
        existing.totalDurationMs += res.durationMs ?? 0;
        if (res.data.is_error) existing.errors++;
      }
    }
  }

  const toolCalls: ToolCallSummary[] = Array.from(toolMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count);

  const firstUserMsg = events.find((e) => e.type === "message.user");
  const titleText = (firstUserMsg?.data?.content as string) ?? "Agent Session";
  const title =
    titleText.length > 80 ? titleText.slice(0, 77) + "..." : titleText;

  const agentMessages = events.filter((e) => e.type === "message.agent");
  const report = agentMessages
    .reverse()
    .find((e) => ((e.data.content as string) ?? "").length > 200);
  const reportText = report ? (report.data.content as string) : undefined;

  return {
    title,
    startedAt: startTime,
    endedAt: endTime,
    durationMs,
    eventCount: events.length,
    toolCalls,
    errorCount: errors.length,
    model: meta.model,
    totalTokens: meta.totalTokens || undefined,
    totalCostUsd: meta.totalCostUsd || undefined,
    report: reportText,
  };
}
