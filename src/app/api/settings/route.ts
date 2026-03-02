import { NextRequest } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".agentreel");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

async function getAdminToken(): Promise<string | null> {
  try {
    const data = await readFile(CONFIG_FILE, "utf-8");
    const config = JSON.parse(data);
    return config._admin_token || null;
  } catch {
    return null;
  }
}

function isAuthorized(request: NextRequest, token: string | null): boolean {
  if (!token) return true;

  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ") && authHeader.slice(7) === token) {
    return true;
  }

  const cookieToken = request.cookies.get("agentreel_token")?.value;
  if (cookieToken === token) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  const token = await getAdminToken();
  if (!isAuthorized(request, token)) {
    return Response.json(
      { error: "Unauthorized. Provide admin token via Bearer header or cookie." },
      { status: 401 }
    );
  }

  try {
    const data = await readFile(CONFIG_FILE, "utf-8");
    const config = JSON.parse(data);
    const { _admin_token: _, ...safeConfig } = config;
    return Response.json(safeConfig);
  } catch {
    return Response.json({});
  }
}

export async function POST(request: NextRequest) {
  const token = await getAdminToken();
  if (!isAuthorized(request, token)) {
    return Response.json(
      { error: "Unauthorized. Provide admin token via Bearer header or cookie." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const safeConfig: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string" && value.length < 1000) {
        safeConfig[key] = value;
      }
    }

    let existing: Record<string, string> = {};
    try {
      const data = await readFile(CONFIG_FILE, "utf-8");
      existing = JSON.parse(data);
    } catch { /* first save */ }

    if (existing._admin_token) {
      safeConfig._admin_token = existing._admin_token;
    }

    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(safeConfig, null, 2));

    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
