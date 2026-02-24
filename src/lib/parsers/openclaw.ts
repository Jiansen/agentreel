import type {
  TimelineEvent,
  EventType,
  ParsedSession,
  SessionSummary,
  ToolCallSummary,
} from "@/types/timeline";

interface OpenClawMessage {
  role: "user" | "assistant" | "system";
  content: string | OpenClawContentBlock[];
  timestamp?: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  cost_usd?: number;
  duration_ms?: number;
  session_id?: string;
  uuid?: string;
}

interface OpenClawContentBlock {
  type: "text" | "tool_use" | "tool_result" | "thinking" | "image";
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | OpenClawContentBlock[];
  is_error?: boolean;
}

function extractTimestamp(msg: OpenClawMessage, index: number): string {
  if (msg.timestamp) return msg.timestamp;
  return new Date(Date.now() - (1000 - index) * 1000).toISOString();
}

function contentToText(
  content: string | OpenClawContentBlock[] | undefined
): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .map((block) => {
      if (block.type === "text") return block.text ?? "";
      if (block.type === "thinking") return block.thinking ?? "";
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function parseOpenClawJsonl(raw: string): ParsedSession {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const messages: OpenClawMessage[] = [];
  for (const line of lines) {
    try {
      messages.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }

  if (messages.length === 0) {
    throw new Error("No valid JSONL messages found");
  }

  const events: TimelineEvent[] = [];
  let seq = 0;
  const toolTimings = new Map<string, { seq: number; timestamp: string }>();

  // Session start
  seq++;
  events.push({
    seq,
    type: "session.start",
    timestamp: extractTimestamp(messages[0], 0),
    data: {
      model: messages[0].model,
      session_id: messages[0].session_id,
    },
    raw: { type: "session.start" },
  });

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const ts = extractTimestamp(msg, i);

    if (msg.role === "user") {
      // Check if this "user" message is actually tool results
      const contentBlocks = Array.isArray(msg.content) ? msg.content : [];
      const hasToolResults = contentBlocks.some(
        (b) => b.type === "tool_result"
      );

      if (hasToolResults) {
        // Process tool results only — skip creating a user message event
        for (const block of contentBlocks) {
          if (block.type === "tool_result" && block.tool_use_id) {
            seq++;
            const resultText =
              typeof block.content === "string"
                ? block.content
                : contentToText(
                    block.content as OpenClawContentBlock[]
                  );

            let durationMs: number | undefined;
            const requestInfo = toolTimings.get(block.tool_use_id);
            if (requestInfo) {
              const requestTime = new Date(
                requestInfo.timestamp
              ).getTime();
              const resultTime = new Date(ts).getTime();
              if (resultTime > requestTime) {
                durationMs = resultTime - requestTime;
              }
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

      // Regular user message
      seq++;
      events.push({
        seq,
        type: "message.user",
        timestamp: ts,
        data: {
          content: contentToText(msg.content),
          model: msg.model,
        },
        raw: msg,
      });
      continue;
    }

    if (msg.role === "assistant") {
      const contentBlocks = Array.isArray(msg.content) ? msg.content : [];
      const textParts: string[] = [];
      const toolUses: OpenClawContentBlock[] = [];

      for (const block of contentBlocks) {
        if (block.type === "text" && block.text) {
          textParts.push(block.text);
        } else if (block.type === "thinking" && block.thinking) {
          textParts.push(`*Thinking:* ${block.thinking}`);
        } else if (block.type === "tool_use") {
          toolUses.push(block);
        }
      }

      if (typeof msg.content === "string") {
        textParts.push(msg.content);
      }

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
              ? (msg.usage.input_tokens ?? 0) +
                (msg.usage.output_tokens ?? 0)
              : undefined,
            cost_usd: msg.cost_usd,
            duration_ms: msg.duration_ms,
          },
          raw: msg,
        });
      }

      for (const tool of toolUses) {
        seq++;
        const toolEvent: TimelineEvent = {
          seq,
          type: "tool.request",
          timestamp: ts,
          data: {
            tool_name: tool.name ?? "unknown",
            tool_use_id: tool.id,
            parameters: tool.input ?? {},
          },
          raw: tool,
        };
        events.push(toolEvent);
        if (tool.id) {
          toolTimings.set(tool.id, { seq, timestamp: ts });
        }
      }

      continue;
    }

    // Non-user, non-assistant messages with tool results (fallback for unusual formats)
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === "tool_result" && block.tool_use_id) {
          seq++;
          const resultText =
            typeof block.content === "string"
              ? block.content
              : contentToText(block.content as OpenClawContentBlock[]);

          events.push({
            seq,
            type: "tool.result",
            timestamp: ts,
            data: {
              tool_use_id: block.tool_use_id,
              output: resultText,
              is_error: block.is_error ?? false,
            },
            raw: block,
          });
        }
      }
    }
  }

  // Session end
  const lastMsg = messages[messages.length - 1];
  seq++;
  events.push({
    seq,
    type: "session.end",
    timestamp: extractTimestamp(lastMsg, messages.length - 1),
    data: {},
    raw: { type: "session.end" },
  });

  const summary = buildSummary(events, messages);
  return { summary, events };
}

function buildSummary(
  events: TimelineEvent[],
  messages: OpenClawMessage[]
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

  // Build tool call summaries
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

  // Extract first user message as title
  const firstUserMsg = events.find((e) => e.type === "message.user");
  const titleText = (firstUserMsg?.data?.content as string) ?? "Agent Session";
  const title =
    titleText.length > 80 ? titleText.slice(0, 77) + "..." : titleText;

  // Aggregate tokens and cost
  let totalTokens = 0;
  let totalCostUsd = 0;
  for (const msg of messages) {
    if (msg.usage) {
      totalTokens +=
        (msg.usage.input_tokens ?? 0) + (msg.usage.output_tokens ?? 0);
    }
    if (msg.cost_usd) totalCostUsd += msg.cost_usd;
  }

  return {
    title,
    startedAt: startTime,
    endedAt: endTime,
    durationMs,
    eventCount: events.length,
    toolCalls,
    errorCount: errors.length,
    model: messages.find((m) => m.model)?.model,
    totalTokens: totalTokens || undefined,
    totalCostUsd: totalCostUsd || undefined,
  };
}
