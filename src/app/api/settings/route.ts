import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".agentreel");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

function isLocalRequest(request: NextRequest): boolean {
  const host = request.headers.get("host") || "";
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.")
  );
}

export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return Response.json(
      { error: "Settings only accessible from localhost" },
      { status: 403 }
    );
  }

  try {
    const data = await readFile(CONFIG_FILE, "utf-8");
    return Response.json(JSON.parse(data));
  } catch {
    return Response.json({});
  }
}

export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return Response.json(
      { error: "Settings only accessible from localhost" },
      { status: 403 }
    );
  }

  try {
    const config = await request.json();

    const safeConfig: Record<string, string> = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === "string" && value.length < 1000) {
        safeConfig[key] = value;
      }
    }

    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(safeConfig, null, 2));

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
