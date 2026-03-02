import { NextRequest } from "next/server";

const RELAY_URL = process.env.AGENTREEL_RELAY_URL || "http://127.0.0.1:8765";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const relayPath = "/" + path.join("/");
  const targetUrl = `${RELAY_URL}${relayPath}`;

  const isSSE =
    relayPath === "/api/stream" ||
    request.headers.get("accept")?.includes("text/event-stream");

  try {
    const res = await fetch(targetUrl, {
      headers: {
        accept: isSSE ? "text/event-stream" : "application/json",
      },
      signal: request.signal,
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Relay returned ${res.status}` }), {
        status: res.status,
        headers: { "content-type": "application/json" },
      });
    }

    if (isSSE && res.body) {
      return new Response(res.body, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "access-control-allow-origin": "*",
        },
      });
    }

    const body = await res.text();
    return new Response(body, {
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        "access-control-allow-origin": "*",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Relay connection failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
