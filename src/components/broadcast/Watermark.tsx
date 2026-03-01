"use client";

export default function Watermark() {
  return (
    <>
      <span
        className="absolute z-10 pointer-events-none select-none text-sm font-bold tracking-wider animate-[wm-float_60s_linear_infinite]"
        style={{ color: "rgba(139, 92, 246, 0.08)", top: "15%", left: "10%" }}
      >
        AgentReel
      </span>
      <span
        className="absolute z-10 pointer-events-none select-none text-[10px] font-bold tracking-wider animate-[wm-float_45s_linear_infinite_reverse]"
        style={{ color: "rgba(139, 92, 246, 0.06)", top: "50%", left: "40%", animationDelay: "-20s" }}
      >
        agentreel.agent-status.com
      </span>
    </>
  );
}
