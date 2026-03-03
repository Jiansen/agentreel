import { NextRequest } from "next/server";

const GITHUB_TOKEN = process.env.AGENTREEL_GITHUB_ISSUE_WRITE_TOKEN;
const GITHUB_REPO = "Jiansen/agentreel";

function osLabel(os: string): string {
  const lower = os.toLowerCase();
  if (lower.includes("ubuntu") || lower.includes("debian")) return "linux-debian";
  if (lower.includes("centos") || lower.includes("rhel") || lower.includes("fedora")) return "linux-rhel";
  if (lower.includes("linux")) return "linux";
  if (lower.includes("darwin") || lower.includes("macos") || lower.includes("mac")) return "macos";
  return "os-other";
}

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
      agent = "unknown",
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      public_ip = "",
      components = {},
    } = report;

    const emoji = result === "success" ? "✅" : result === "failed" ? "❌" : "⚠️";
    const osShort = os.split(" ")[0];

    const labels = ["install-report", osLabel(os)];
    if (result === "failed") labels.push("bug");
    if (result === "success") labels.push("install-success");
    if (has_openclaw) labels.push("has-openclaw");
    if (agent && agent !== "unknown" && agent !== "human") labels.push("agent-installed");

    const title = `${emoji} Install ${result}: ${osShort} / Node ${node} (${duration_s}s)`;

    const componentLines = typeof components === "object" && components !== null
      ? Object.entries(components)
          .map(([k, v]) => `| ${k} | ${v ? "✓" : "✗"} |`)
          .join("\n")
      : "| (none reported) | — |";

    const body = [
      `### Install Report`,
      ``,
      `| Field | Value |`,
      `|-------|-------|`,
      `| **Result** | ${emoji} ${result} |`,
      `| **OS** | ${os} |`,
      `| **Node** | ${node} |`,
      `| **Python** | ${python} |`,
      `| **npm** | ${report.npm || "N/A"} |`,
      `| **OpenClaw** | ${has_openclaw ? "Yes" : "No"} |`,
      `| **Installer** | ${agent} |`,
      `| **Duration** | ${duration_s}s |`,
      `| **Version** | ${version} |`,
      ``,
      `### Components`,
      ``,
      `| Component | Status |`,
      `|-----------|--------|`,
      componentLines,
      ``,
      ...(result === "failed"
        ? [
            `### Failure Details`,
            ``,
            `| Field | Value |`,
            `|-------|-------|`,
            `| **Failed Step** | ${failed_step} |`,
            `| **Error** | \`${error}\` |`,
            ``,
          ]
        : []),
      `<details>`,
      `<summary>Raw report JSON</summary>`,
      ``,
      "```json",
      JSON.stringify(report, null, 2),
      "```",
      `</details>`,
      ``,
      `---`,
      `*Automated install report. No PII collected. Timestamp: ${report.timestamp || "N/A"}*`,
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
    return Response.json({
      ok: true,
      note: "Logged (no GitHub token configured)",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return Response.json({ ok: false, error: msg }, { status: 400 });
  }
}
