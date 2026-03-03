"use client";

export default function SettingsFloat() {
  if (process.env.NEXT_PUBLIC_VERCEL === "1") return null;

  return (
    <a
      href="/settings"
      className="fixed bottom-4 right-4 z-50 w-9 h-9 rounded-full bg-[#1a1a2e]/80 backdrop-blur
        border border-white/10 flex items-center justify-center
        text-gray-400 hover:text-white hover:bg-[#1a1a2e] transition-all shadow-lg"
      title="Settings"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="2.5" />
        <path d="M6.8 1.5h2.4l.4 1.8.8.4 1.7-.7 1.7 1.7-.7 1.7.4.8 1.8.4v2.4l-1.8.4-.4.8.7 1.7-1.7 1.7-1.7-.7-.8.4-.4 1.8H6.8l-.4-1.8-.8-.4-1.7.7-1.7-1.7.7-1.7-.4-.8-1.8-.4V6.8l1.8-.4.4-.8-.7-1.7L3.9 2.2l1.7.7.8-.4z" />
      </svg>
    </a>
  );
}
