"use client";

import { useSearchParams } from "next/navigation";
import BroadcastLayout from "@/components/broadcast/BroadcastLayout";
import type { BroadcastPreset } from "@/types/broadcast";

export default function BroadcastClient() {
  const params = useSearchParams();

  const preset = (params.get("preset") ?? "landscape") as BroadcastPreset;
  const vncUrl = params.get("vnc") ?? "";
  const relayUrl = params.get("relay") ?? "";
  const tabInterval = parseInt(params.get("tabInterval") ?? "10000", 10);
  const missionName = params.get("mission") ?? undefined;

  return (
    <div
      className="w-screen h-screen overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      <BroadcastLayout
        preset={preset}
        vncUrl={vncUrl}
        relayUrl={relayUrl}
        tabIntervalMs={tabInterval}
        missionName={missionName}
      />
    </div>
  );
}
