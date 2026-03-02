import { NextRequest } from "next/server";

const GITHUB_TOKEN = process.env.AGENTREEL_GITHUB_ISSUE_WRITE_TOKEN;
const GITHUB_REPO = "Jiansen/agentreel";

export async function POST(request: NextRequest) {
  try {
    const report = await request.json();

    const {
      version = "unknown",
      os = "unknown",
      node = "unknown",
      python = "unknown",
      result = "unknown",
      duration_s = 0,
      failed_step = "none",
      error = "none",
      has_openclaw = false,
    } = report;

    const labels = ["install-report"];
    if (result === "failed") labels.push("bug");

    const title = `Install ${result}: ${os.split(" ")[0]} / Node ${node} (${duration_s}s)`;
    const body = [
      `### Install Report`,
      ``,
      `| Field | Value |`,
      `|-------|-------|`,
      `| **Result** | ${result} |`,
      `| **OS** | ${os} |`,
      `| **Node** | ${node} |`,
      `| **Python** | ${python} |`,
      `| **npm** | ${report.npm || "N/A"} |`,
      `| **OpenClaw** | ${has_openclaw ? "Yes" : "No"} |`,
      `| **Duration** | ${duration_s}s |`,
      `| **Version** | ${version} |`,
      `| **Failed Step** | ${failed_step} |`,
      `| **Error** | ${error} |`,
      `| **Timestamp** | ${report.timestamp || "N/A"} |`,
      ``,
      `*Automated install report. No PII collected.*`,
    ].join("\n");

    if (GITHUB_TOKEN) {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/issues`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github+json",
          },
          body: JSON.stringify({ title, body, labels }),
        }
      );

      if (res.ok) {
        const issue = await res.json();
        return Response.json({
          ok: true,
          issue_url: issue.html_url,
          issue_number: issue.number,
        });
      }

      return Response.json(
        { ok: false, error: `GitHub API: ${res.status}` },
        { status: 502 }
      );
    }

    console.log("[install-report]", JSON.stringify(report));
    return Response.json({ ok: true, note: "Logged (no GitHub token configured)" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return Response.json({ ok: false, error: msg }, { status: 400 });
  }
}
