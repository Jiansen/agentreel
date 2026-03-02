"use client";

export default function Watermark() {
  const stroke = `
    -3px -3px 0 rgba(0,0,0,0.7),
     3px -3px 0 rgba(0,0,0,0.7),
    -3px  3px 0 rgba(0,0,0,0.7),
     3px  3px 0 rgba(0,0,0,0.7),
     0    -3px 0 rgba(0,0,0,0.6),
     0     3px 0 rgba(0,0,0,0.6),
    -3px   0  0 rgba(0,0,0,0.6),
     3px   0  0 rgba(0,0,0,0.6)
  `.trim();

  return (
    <>
      <span
        className="absolute z-10 pointer-events-none select-none text-5xl font-bold tracking-wider animate-[wm-float_60s_linear_infinite]"
        style={{
          color: "rgba(139, 92, 246, 0.28)",
          textShadow: stroke,
          top: "15%",
          left: "10%",
        }}
      >
        AgentReel
      </span>
      <span
        className="absolute z-10 pointer-events-none select-none text-xl font-bold tracking-wider animate-[wm-float_45s_linear_infinite_reverse]"
        style={{
          color: "rgba(139, 92, 246, 0.22)",
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
