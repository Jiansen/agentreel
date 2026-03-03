import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL === "1" || process.env.NEXT_PUBLIC_VERCEL === "1") {
    return NextResponse.json({ available: false });
  }

  const wsPort = process.env.AGENTREEL_VNC_WS_PORT || "6080";

  try {
    const res = await fetch(`http://127.0.0.1:${wsPort}/vnc_clean.html`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return NextResponse.json({
        available: true,
        port: parseInt(wsPort),
        path: "/vnc_clean.html",
        proxyPath: "/vnc-ws",
      });
    }
  } catch {
    // websockify not running
  }

  return NextResponse.json({ available: false });
}
