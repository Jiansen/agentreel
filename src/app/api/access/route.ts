import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const CONFIG_FILE = join(homedir(), ".agentreel", "config.json");

async function readConfig(): Promise<Record<string, string>> {
  try {
    const data = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  // On Vercel (our hosted site), always public
  if (process.env.VERCEL === "1") {
    return Response.json({ authorized: true, visibility: "public" });
  }

  const config = await readConfig();
  const visibility = config.visibility || "public";

  if (visibility !== "private") {
    return Response.json({ authorized: true, visibility: "public" });
  }

  const liveToken = config.live_token;
  if (!liveToken) {
    return Response.json({ authorized: true, visibility: "private" });
  }

  const urlToken = request.nextUrl.searchParams.get("token");
  const cookieToken = request.cookies.get("agentreel_live")?.value;

  if (urlToken === liveToken || cookieToken === liveToken) {
    return Response.json({ authorized: true, visibility: "private" });
  }

  return Response.json(
    { authorized: false, visibility: "private" },
    { status: 401 }
  );
}
