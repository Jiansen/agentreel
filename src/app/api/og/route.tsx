import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "AI Agent Session Replay";
  const events = searchParams.get("events") || "0";
  const tools = searchParams.get("tools") || "0";
  const model = searchParams.get("model") || "";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #1a1a2e 100%)",
          padding: "60px",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Top: Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #4e8cff, #a78bfa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: "bold",
              color: "white",
            }}
          >
            ▶
          </div>
          <span style={{ fontSize: "36px", fontWeight: "bold", color: "#e8e8f0" }}>
            Agent
            <span style={{ color: "#4e8cff" }}>Reel</span>
          </span>
        </div>

        {/* Middle: Title */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              fontSize: "42px",
              fontWeight: "700",
              color: "#e8e8f0",
              lineHeight: "1.2",
              maxWidth: "900px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title.length > 80 ? title.slice(0, 80) + "..." : title}
          </div>
        </div>

        {/* Bottom: Stats */}
        <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
          {events !== "0" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px", color: "#4e8cff", fontWeight: "600" }}>
                {events}
              </span>
              <span style={{ fontSize: "16px", color: "#6a6a82" }}>events</span>
            </div>
          )}
          {tools !== "0" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px", color: "#f59e0b", fontWeight: "600" }}>
                {tools}
              </span>
              <span style={{ fontSize: "16px", color: "#6a6a82" }}>tool calls</span>
            </div>
          )}
          {model && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", color: "#a78bfa", fontWeight: "500" }}>
                {model}
              </span>
            </div>
          )}
          <div
            style={{
              marginLeft: "auto",
              fontSize: "14px",
              color: "#6a6a82",
            }}
          >
            agentreel.agent-status.com
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
