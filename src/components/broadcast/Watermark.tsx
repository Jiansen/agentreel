"use client";

export default function Watermark() {
  const stroke = `
    -1px -1px 0 rgba(0,0,0,0.3),
     1px -1px 0 rgba(0,0,0,0.3),
    -1px  1px 0 rgba(0,0,0,0.3),
     1px  1px 0 rgba(0,0,0,0.3)
  `.trim();

  return (
    <>
      <span
        className="absolute z-10 pointer-events-none select-none text-sm font-bold tracking-wider animate-[wm-float_60s_linear_infinite]"
        style={{
          color: "rgba(139, 92, 246, 0.15)",
          textShadow: stroke,
          top: "15%",
          left: "10%",
        }}
      >
        AgentReel
      </span>
      <span
        className="absolute z-10 pointer-events-none select-none text-[10px] font-bold tracking-wider animate-[wm-float_45s_linear_infinite_reverse]"
        style={{
          color: "rgba(139, 92, 246, 0.12)",
          textShadow: stroke,
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
