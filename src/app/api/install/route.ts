import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const content = readFileSync(
      join(process.cwd(), "AGENT_INSTALL.md"),
      "utf-8",
    );
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "AGENT_INSTALL.md not found" },
      { status: 500 },
    );
  }
}
