"use client";

import Link from "next/link";
import type { Alert } from "@sentira/types";
import { SeverityBadge } from "./StatusBadge";
import { CaretRight, X } from "@phosphor-icons/react";

interface AlertBannerProps {
  alert: Alert;
  onDismiss?: () => void;
}

export function AlertBanner({ alert, onDismiss }: AlertBannerProps) {
  const isHigh = alert.severity === "HIGH";
  return (
    <div className={`animate-slide-down flex items-center gap-4 rounded-2xl border px-5 py-3.5 ${
      isHigh
        ? "border-ink-soft bg-paper shadow-subtle"
        : "border-hairline bg-paper"
    }`}>
      <SeverityBadge severity={alert.severity} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{alert.message}</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {alert.room} · {new Date(alert.createdAt).toLocaleTimeString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/alerts/${alert.id}`}
          className="flex items-center gap-1 rounded-2xl bg-canvas px-3 py-1.5 text-xs font-medium text-ink no-underline transition-colors hover:bg-ink-soft hover:text-paper"
        >
          View <CaretRight size={12} />
        </Link>
        {onDismiss && (
          <button onClick={onDismiss} className="rounded-lg p-1.5 text-mid-gray transition-colors hover:bg-canvas hover:text-ink">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
