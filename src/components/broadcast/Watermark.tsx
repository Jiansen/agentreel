"use client";

export default function Watermark() {
  const hollowStyle = {
    color: "transparent",
    WebkitTextStroke: "1.5px rgba(139, 92, 246, 0.35)",
  } as React.CSSProperties;

  const hollowStyleSm = {
    color: "transparent",
    WebkitTextStroke: "1px rgba(139, 92, 246, 0.28)",
  } as React.CSSProperties;

  return (
    <>
      <span
        className="absolute z-10 pointer-events-none select-none text-5xl font-bold tracking-wider animate-[wm-float_60s_linear_infinite]"
        style={{
          ...hollowStyle,
          top: "15%",
          left: "10%",
        }}
      >
        AgentReel
      </span>
      <span
        className="absolute z-10 pointer-events-none select-none text-xl font-bold tracking-wider animate-[wm-float_45s_linear_infinite_reverse]"
        style={{
          ...hollowStyleSm,
          top: "50%",
          left: "40%",
          animationDelay: "-20s",
        }}
      >
        agentreel.agent-status.com
      </span>
    </>
  );
}
