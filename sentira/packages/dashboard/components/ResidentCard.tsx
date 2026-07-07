"use client";

import Link from "next/link";
import type { OverviewSnapshot } from "@sentira/types";
import { StatusBadge } from "./StatusBadge";
import { SensorHealth } from "./SensorHealth";
import { Wind, Heart, ArrowRight } from "@phosphor-icons/react";

interface ResidentCardProps {
  resident: OverviewSnapshot["residents"][number];
}

export function ResidentCard({ resident }: ResidentCardProps) {
  const hasAlert = resident.status === "alert";
  const hasAttention = resident.status === "attention";

  return (
    <Link
      href={`/residents/${resident.id}`}
      className={`group relative block rounded-2xl border bg-surface p-5 no-underline transition-all duration-200 hover:bg-surface-elevated hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 ${
        hasAlert
          ? "border-danger/25 shadow-danger/[0.06]"
          : hasAttention
          ? "border-warning/20"
          : "border-border-subtle"
      }`}
    >
      {/* Alert glow overlay */}
      {hasAlert && (
        <div className="absolute inset-0 rounded-2xl bg-danger/[0.03] pointer-events-none" />
      )}

      {/* Header */}
      <div className="relative mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-heading text-lg text-text">{resident.name}</h3>
          <p className="mt-0.5 text-sm text-text-secondary">{resident.room}</p>
        </div>
        <StatusBadge status={resident.status} />
      </div>

      {/* Vitals */}
      <div className="relative mb-4 flex items-center gap-5">
        {resident.breathingRate != null && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Wind size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Breathing</p>
              <p className="text-sm font-semibold text-text">
                {resident.breathingRate} <span className="text-xs font-normal text-text-muted">bpm</span>
              </p>
            </div>
          </div>
        )}
        {resident.heartRate != null && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger/10">
              <Heart size={16} weight="fill" className="text-danger" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Heart</p>
              <p className="text-sm font-semibold text-text">
                {resident.heartRate} <span className="text-xs font-normal text-text-muted">bpm</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative flex items-center justify-between border-t border-border-subtle pt-3">
        <SensorHealth online={resident.sensorOnline} lastSeen={resident.sensorLastSeen} />
        <ArrowRight
          size={14}
          className="text-text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
        />
      </div>
    </Link>
  );
}
