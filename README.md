<p align="center">
  <strong>▶ AgentReel</strong>
  <br />
  <em>Beautiful replay viewer for AI agent sessions</em>
</p>

<p align="center">
  <a href="https://reels.agent-status.com/?demo">Live Demo</a> ·
  <a href="https://reels.agent-status.com/openclaw-replay">OpenClaw Replay</a> ·
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick Start</a>
</p>

---

## What is AgentReel?

AgentReel turns your AI agent transcripts into beautiful, interactive timelines. Drag & drop a JSONL file, watch the session unfold step by step, and share it with a single click.

Currently supports **OpenClaw** transcripts. More formats coming soon.

## Features

- **Drag & Drop** — Just drop your `.jsonl` file. No upload, no account, no install.
- **Interactive Timeline** — Step through events with playback controls. Filter by type. Search by keyword.
- **One-Click Sharing** — Generate shareable links (data compressed in URL) or download standalone HTML files.
- **Session Insights** — See total tokens, cost, duration, tool call stats, and errors at a glance.
- **Privacy First** — Everything runs in your browser. Your data never leaves your machine.
- **Dark Theme** — Designed for developers. Color-coded events, smooth animations, zero noise.

## Quick Start

### Use Online

Visit **[reels.agent-status.com](https://reels.agent-status.com)** and drop your OpenClaw JSONL file.

Or try the demo: [reels.agent-status.com/?demo](https://reels.agent-status.com/?demo)

### Run Locally

```bash
git clone https://github.com/Jiansen/agentreel.git
cd agentreel
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Supported Formats

| Format | Status |
|--------|--------|
| OpenClaw JSONL | Supported |
| OpenHands sessions | Planned |
| LangChain traces | Planned |
| Generic JSONL | Planned |

## Sharing

AgentReel offers three ways to share sessions:

1. **Share Link** — Compresses transcript data into the URL hash. No server needed. Works for small-to-medium sessions.
2. **Standalone HTML** — Downloads a single `.html` file with embedded data and viewer. Share via email, Slack, or anywhere.
3. **Raw JSONL** — Download the original transcript file.

## Tech Stack

- [Next.js](https://nextjs.org/) 15+ with App Router
- [React](https://react.dev/) 19
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Framer Motion](https://www.framer.com/motion/) for animations
- [react-markdown](https://github.com/remarkjs/react-markdown) + remark-gfm for content rendering

## Contributing

Contributions welcome! Areas where help is needed:

- **New parser adapters** — Add support for other agent frameworks
- **UI/UX improvements** — Animations, responsive layout, accessibility
- **Performance** — Handle very large transcripts (10k+ events)

## License

MIT
