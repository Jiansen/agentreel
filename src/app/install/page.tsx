import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Install AgentReel — Let Your Agent Do It",
  description:
    "Send this link to your OpenClaw agent and it will install AgentReel for you. No manual setup required.",
  openGraph: {
    title: "Install AgentReel — Let Your Agent Do It",
    description:
      "Send one link to your AI agent. It handles the rest.",
    type: "website",
  },
};

const AGENT_URL = "https://agentreel.agent-status.com/api/install";
const GITHUB_URL = "https://github.com/Jiansen/agentreel";

export default function InstallPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">
            Install AgentReel
          </h1>
          <p className="text-lg text-[var(--text-secondary)]">
            Your AI agent can install AgentReel for you.
            <br />
            Just send it the link below.
          </p>
        </div>

        {/* Agent install card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center text-xl">
              🤖
            </div>
            <div>
              <h2 className="text-lg font-semibold">For Your Agent</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Send this URL as a message to your OpenClaw agent
              </p>
            </div>
          </div>

          <div className="relative">
            <code className="block w-full p-4 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm font-mono break-all select-all">
              Read and follow the installation instructions at {AGENT_URL}
            </code>
          </div>

          <p className="text-xs text-[var(--text-secondary)]">
            The agent will read the installation runbook, check prerequisites,
            install dependencies, build the project, and verify everything works.
            Each step includes verification commands and failure recovery.
          </p>
        </div>

        {/* Manual install card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-green)]/10 flex items-center justify-center text-xl">
              👤
            </div>
            <div>
              <h2 className="text-lg font-semibold">Manual Install</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Prefer to do it yourself? Three commands:
              </p>
            </div>
          </div>

          <pre className="p-4 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm font-mono overflow-x-auto">
{`git clone ${GITHUB_URL}.git
cd agentreel && npm install
npm run dev`}
          </pre>

          <p className="text-xs text-[var(--text-secondary)]">
            Then visit{" "}
            <a href="http://localhost:3000" className="text-[var(--accent-blue)] hover:underline">
              localhost:3000
            </a>
          </p>
        </div>

        {/* No install needed card */}
        <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center space-y-2">
          <p className="text-sm text-[var(--text-secondary)]">
            <strong>No install needed?</strong> Use AgentReel directly in your browser:
          </p>
          <a
            href="/"
            className="inline-block px-5 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-[var(--accent-blue)]/80 transition-colors"
          >
            Open AgentReel
          </a>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-[var(--text-secondary)] space-y-1">
          <p>
            <a href={GITHUB_URL} className="hover:underline">
              GitHub
            </a>
            {" · "}
            <a href="/AGENT_INSTALL.md" className="hover:underline">
              Raw Install Doc
            </a>
            {" · "}
            <a href="/?demo" className="hover:underline">
              Demo
            </a>
          </p>
          <p>MIT License</p>
        </div>
      </div>
    </div>
  );
}
