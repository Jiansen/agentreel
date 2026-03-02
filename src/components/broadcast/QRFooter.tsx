"use client";

interface QRFooterProps {
  url?: string;
  title?: string;
  hint?: string;
}

export default function QRFooter({
  url = "github.com/Jiansen/agentreel/issues",
  title = "Feedback & Feature Requests",
  hint = "Scan or visit to submit feedback",
}: QRFooterProps) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`https://${url}`)}&bgcolor=0d0d1a&color=ffffff&format=svg`;

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 border-t border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
      <img
        src={qrSrc}
        alt="QR Code"
        className="w-[52px] h-[52px] rounded border border-[var(--border)]"
        loading="lazy"
      />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[9px] font-semibold text-[var(--text-secondary)] leading-tight">
          {title}
        </span>
        <span className="text-[8px] text-[var(--accent-blue)] truncate">
          {url}
        </span>
        <span className="text-[7px] text-[var(--text-muted)]">{hint}</span>
      </div>
    </div>
  );
}
