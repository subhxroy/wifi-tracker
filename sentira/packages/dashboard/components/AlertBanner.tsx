"use client";

import Link from "next/link";
import type { Alert } from "@sentira/types";
import { SeverityBadge } from "./StatusBadge";
import { X, CaretRight } from "@phosphor-icons/react";

interface AlertBannerProps {
  alert: Alert;
  onDismiss?: () => void;
}

export function AlertBanner({ alert, onDismiss }: AlertBannerProps) {
  const bg = alert.severity === "HIGH" ? "bg-danger-bg border-danger/30" : "bg-amber-bg border-amber/30";
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${bg}`}>
      <SeverityBadge severity={alert.severity} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{alert.message}</p>
        <p className="text-xs text-text-muted">
          {alert.room} · {new Date(alert.createdAt).toLocaleTimeString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/alerts/${alert.id}`}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-muted no-underline"
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
