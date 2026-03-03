import { NextResponse } from "next/server";

const REPO = "Jiansen/agentreel";
const APPROVED_LABEL = "showcase-approved";
const PINNED_LABEL = "showcase-pinned";

export interface ShowcaseEntry {
  id: number;
  title: string;
  description: string;
  videoUrl: string;
  screenshotUrl?: string;
  framework: string;
  author: string;
  authorUrl: string;
  avatarUrl: string;
  issueUrl: string;
  createdAt: string;
  pinned: boolean;
}

function parseIssueBody(body: string): {
  description: string;
  videoUrl: string;
  screenshotUrl?: string;
  framework: string;
} {
  const sections: Record<string, string> = {};
  let currentKey = "";

  for (const line of body.split("\n")) {
    if (line.startsWith("### ")) {
      currentKey = line.slice(4).trim().toLowerCase();
    } else if (currentKey) {
      const existing = sections[currentKey] || "";
      sections[currentKey] = (existing + "\n" + line).trim();
    }
  }

  const screenshotRaw =
    sections["screenshot (16:9)"] || sections["screenshot"] || "";
  const imgMatch = screenshotRaw.match(
    /!\[.*?\]\((https:\/\/[^)]+)\)|(?:^|\s)(https:\/\/(?:user-images|github)\.githubusercontent\.com\/[^\s)]+)/m
  );

  return {
    description:
      sections["what does your agent do?"] || sections["description"] || "",
    videoUrl: extractUrl(sections["video url"]) || "",
    screenshotUrl: imgMatch ? imgMatch[1] || imgMatch[2] : undefined,
    framework: sections["agent framework"] || "Other",
  };
}

function extractUrl(text?: string): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed || trimmed === "_No response_") return undefined;
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return undefined;
  }
}

let cache: { data: ShowcaseEntry[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/issues?labels=${APPROVED_LABEL}&state=open&per_page=20&sort=created&direction=desc`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "AgentReel-Homepage",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      cache = { data: [], ts: Date.now() };
      return NextResponse.json([], {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }

    const issues = await res.json();
    const showcases: ShowcaseEntry[] = issues
      .filter((issue: { pull_request?: unknown }) => !issue.pull_request)
      .map(
        (issue: {
          number: number;
          title: string;
          body: string;
          user: { login: string; html_url: string; avatar_url: string };
          html_url: string;
          created_at: string;
          labels: { name: string }[];
        }): ShowcaseEntry => {
          const parsed = parseIssueBody(issue.body || "");
          const isPinned = issue.labels.some(
            (l: { name: string }) => l.name === PINNED_LABEL
          );
          return {
            id: issue.number,
            title: issue.title.replace(/^\[Showcase\]\s*/i, ""),
            description: parsed.description,
            videoUrl: parsed.videoUrl,
            screenshotUrl: parsed.screenshotUrl,
            framework: parsed.framework,
            author: issue.user.login,
            authorUrl: issue.user.html_url,
            avatarUrl: issue.user.avatar_url,
            issueUrl: issue.html_url,
            createdAt: issue.created_at,
            pinned: isPinned,
          };
        }
      );

    showcases.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

    cache = { data: showcases, ts: Date.now() };
    return NextResponse.json(showcases, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json([], {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }
}
