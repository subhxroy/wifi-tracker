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
    <div className={`animate-slide-down flex items-center gap-4 rounded-xl border px-5 py-3.5 ${
      isHigh
        ? "border-danger/20 bg-danger-muted shadow-lg shadow-danger/[0.05]"
        : "border-warning/20 bg-warning-muted"
    }`}>
      <SeverityBadge severity={alert.severity} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{alert.message}</p>
        <p className="mt-0.5 text-xs text-text-secondary">
          {alert.room} · {new Date(alert.createdAt).toLocaleTimeString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/alerts/${alert.id}`}
          className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary no-underline transition-colors hover:bg-primary/20"
        >
          View <CaretRight size={12} />
        </Link>
        {onDismiss && (
          <button onClick={onDismiss} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-elevated hover:text-text">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
