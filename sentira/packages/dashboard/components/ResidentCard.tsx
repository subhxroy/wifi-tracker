"use client";

import Link from "next/link";
import type { OverviewSnapshot } from "@sentira/types";
import { StatusBadge } from "./StatusBadge";
import { SensorHealth } from "./SensorHealth";
import { timeAgo } from "@/lib/format";
import { Wind, Heart, ArrowRight } from "@phosphor-icons/react";

interface ResidentCardProps {
  resident: OverviewSnapshot["residents"][number];
}

export function ResidentCard({ resident }: ResidentCardProps) {
  const hasAlert = resident.status === "alert";
  const hasAttention = resident.status === "attention";
  const noData = !resident.sensorOnline && !resident.sensorLastSeen;
  const sensorOffline = !resident.sensorOnline && !!resident.sensorLastSeen;

  return (
    <Link
      href={`/residents/${resident.id}`}
      className={`group relative block rounded-3xl border bg-paper p-5 no-underline shadow-subtle transition-all duration-200 hover:-translate-y-0.5 hover:shadow-subtle ${
        sensorOffline && !hasAlert
          ? "border-ember"
          : noData
          ? "border-hairline opacity-70"
          : "border-hairline"
      }`}
    >
      <div className="relative mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">{resident.name}</h3>
          <p className="mt-0.5 text-sm text-ink-soft">{resident.room}</p>
        </div>
        <StatusBadge status={noData ? "no-data" : resident.status} />
      </div>

      <div className="relative mb-4 flex items-center gap-5">
        {resident.breathingRate != null ? (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-canvas">
              <Wind size={16} className="text-ink-soft" />
            </div>
            <div>
              <p className="text-xs text-mid-gray">Breathing</p>
              <p className="text-sm font-semibold text-ink">
                {resident.breathingRate} <span className="text-xs font-normal text-mid-gray">bpm</span>
              </p>
            </div>
          </div>
        ) : noData ? null : (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-canvas">
              <Wind size={16} className="text-mid-gray" />
            </div>
            <div>
              <p className="text-xs text-mid-gray">Breathing</p>
              <p className="text-sm text-mid-gray">—</p>
            </div>
          </div>
        )}
        {resident.heartRate != null ? (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-canvas">
              <Heart size={16} weight="fill" className="text-ink-soft" />
            </div>
            <div>
              <p className="text-xs text-mid-gray">Heart</p>
              <p className="text-sm font-semibold text-ink">
                {resident.heartRate} <span className="text-xs font-normal text-mid-gray">bpm</span>
              </p>
            </div>
          </div>
        ) : noData ? null : (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-canvas">
              <Heart size={16} weight="fill" className="text-mid-gray" />
            </div>
            <div>
              <p className="text-xs text-mid-gray">Heart</p>
              <p className="text-sm text-mid-gray">—</p>
            </div>
          </div>
        )}
      </div>

      <div className="relative flex items-center justify-between border-t border-hairline pt-3">
        <div className="flex items-center gap-3">
          <SensorHealth online={resident.sensorOnline} lastSeen={resident.sensorLastSeen} />
          {resident.lastActivity && (
            <span className="text-xs text-mid-gray">
              Activity {timeAgo(resident.lastActivity)}
            </span>
          )}
        </div>
        <ArrowRight
          size={14}
          className="text-mid-gray transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink"
        />
      </div>
    </Link>
  );
}
