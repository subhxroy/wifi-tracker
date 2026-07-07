"use client";

import Link from "next/link";
import type { OverviewSnapshot } from "@sentira/types";
import { StatusBadge } from "./StatusBadge";
import { SensorHealth } from "./SensorHealth";

interface ResidentCardProps {
  resident: OverviewSnapshot["residents"][number];
}

export function ResidentCard({ resident }: ResidentCardProps) {
  const hasAlert = resident.status === "alert";
  const ring = hasAlert ? "ring-1 ring-danger/40" : resident.status === "attention" ? "ring-1 ring-amber/30" : "ring-1 ring-border";

  return (
    <Link
      href={`/residents/${resident.id}`}
      className={`group block rounded-xl bg-surface p-5 no-underline transition-all hover:bg-surface-elevated ${ring}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold text-text">{resident.name}</h3>
          <p className="text-sm text-text-muted">{resident.room}</p>
        </div>
        <StatusBadge status={resident.status} />
      </div>

      <div className="mb-3 flex items-center gap-4 text-sm">
        {resident.breathingRate && (
          <div>
            <span className="text-text-dim">Breathing</span>
            <p className="font-medium text-text">{resident.breathingRate} <span className="text-xs text-text-dim">bpm</span></p>
          </div>
        )}
        {resident.heartRate && (
          <div>
            <span className="text-text-dim">Heart</span>
            <p className="font-medium text-text">{resident.heartRate} <span className="text-xs text-text-dim">bpm</span></p>
          </div>
        )}
      </div>

      <SensorHealth online={resident.sensorOnline} lastSeen={resident.sensorLastSeen} />
    </Link>
  );
}
