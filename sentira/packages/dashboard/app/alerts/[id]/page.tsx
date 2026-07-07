"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Alert, SseEvent } from "@sentira/types";
import { getAlert, acknowledgeAlert, escalateAlert, markFalseAlarm, resolveAlert } from "@/lib/middleware-api";
import { useSse } from "@/lib/use-sse";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { SeverityBadge } from "@/components/StatusBadge";
import { Spinner } from "@/components/Spinner";
import { SignInForm } from "@/components/SignInForm";
import { formatDateTime, timeAgo } from "@/lib/format";
import { ArrowLeft, CheckCircle, XCircle, CaretDoubleRight, Check } from "@phosphor-icons/react";

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAlert = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getAlert(id);
      setAlert(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (user) fetchAlert();
  }, [user, fetchAlert]);

  useSse(
    useCallback((event: SseEvent) => {
      if (event.type === "alert_updated" && event.alert.id === id) setAlert(event.alert);
    }, [id]),
    !!user,
  );

  const doAction = async (action: string, fn: () => Promise<Alert>) => {
    setActionLoading(action);
    try {
      const updated = await fn();
      setAlert(updated);
    } catch (err) {
      console.error(`${action} failed`, err);
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  if (!user) {
    return <SignInForm />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <div className="flex items-center justify-center pt-28">
          <Spinner size={28} />
        </div>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <div className="mx-auto max-w-3xl px-6 pt-28">
          <div className="rounded-2xl border border-danger/20 bg-danger-muted p-5 text-sm text-danger">
            {error ?? "Alert not found"}
          </div>
        </div>
      </div>
    );
  }

  const isActive = alert.status === "active" || alert.status === "escalated";

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 pt-24 pb-12">
        {/* Back */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-muted no-underline transition-colors hover:text-text"
        >
          <ArrowLeft size={14} />
          Back to overview
        </Link>

        {/* Header */}
        <div className="mb-6 animate-fade-in">
          <div className="mb-2 flex items-center gap-3">
            <SeverityBadge severity={alert.severity} />
            <h1 className="font-heading text-2xl text-text capitalize">
              {alert.type.replace(/_/g, " ")}
            </h1>
          </div>
          <p className="text-sm text-text-secondary">
            {alert.residentName} · {alert.room} · {formatDateTime(alert.createdAt)}
          </p>
        </div>

        {/* Message */}
        <div className="mb-6 rounded-2xl border border-border-subtle bg-surface p-6">
          <p className="text-base leading-relaxed text-text">{alert.message}</p>
          {alert.context?.detail && (
            <p className="mt-2 text-sm text-text-secondary">{alert.context.detail}</p>
          )}
        </div>

        {/* Vital context */}
        {alert.context && (alert.context.breathingRate || alert.context.heartRate) && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 stagger-children">
            {alert.context.breathingRate != null && (
              <div className="rounded-2xl border border-border-subtle bg-surface p-5">
                <span className="text-xs text-text-muted">Breathing rate (trend estimate)</span>
                <p className="mt-1 font-heading text-3xl text-text">
                  {alert.context.breathingRate} <span className="text-sm font-normal text-text-muted">bpm</span>
                </p>
              </div>
            )}
            {alert.context.heartRate != null && (
              <div className="rounded-2xl border border-border-subtle bg-surface p-5">
                <span className="text-xs text-text-muted">Heart rate (trend estimate)</span>
                <p className="mt-1 font-heading text-3xl text-text">
                  {alert.context.heartRate} <span className="text-sm font-normal text-text-muted">bpm</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {isActive && (
          <div className="mb-6 flex flex-wrap gap-2.5 stagger-children">
            <button
              onClick={() => doAction("acknowledge", () => acknowledgeAlert(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-canvas transition-all hover:bg-primary-hover active:scale-[0.97] disabled:opacity-50"
            >
              {actionLoading === "acknowledge" ? <Spinner size={14} /> : <CheckCircle size={16} />}
              Acknowledge
            </button>
            <button
              onClick={() => doAction("escalate", () => escalateAlert(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 rounded-xl border border-warning/25 bg-warning-muted px-5 py-2.5 text-sm font-medium text-warning transition-all hover:bg-warning/20 active:scale-[0.97] disabled:opacity-50"
            >
              {actionLoading === "escalate" ? <Spinner size={14} /> : <CaretDoubleRight size={16} />}
              Escalate now
            </button>
            <button
              onClick={() => doAction("false-alarm", () => markFalseAlarm(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-secondary transition-all hover:text-text active:scale-[0.97] disabled:opacity-50"
            >
              {actionLoading === "false-alarm" ? <Spinner size={14} /> : <XCircle size={16} />}
              False alarm
            </button>
            <button
              onClick={() => doAction("resolve", () => resolveAlert(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 rounded-xl border border-success/25 bg-success-muted px-5 py-2.5 text-sm font-medium text-success transition-all hover:bg-success/20 active:scale-[0.97] disabled:opacity-50"
            >
              {actionLoading === "resolve" ? <Spinner size={14} /> : <Check size={16} />}
              Resolve
            </button>
          </div>
        )}

        {/* Status info */}
        <div className="mb-6 rounded-2xl border border-border-subtle bg-surface p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Status</h3>
          <div className="space-y-1.5 text-sm">
            <StatusRow label="Current status" value={alert.status} />
            {alert.escalationCount > 0 && (
              <StatusRow label="Escalation rounds" value={String(alert.escalationCount)} />
            )}
            {alert.acknowledgedAt && (
              <StatusRow label="Acknowledged at" value={formatDateTime(alert.acknowledgedAt)} />
            )}
            {alert.acknowledgedBy && (
              <StatusRow label="Acknowledged by" value={alert.acknowledgedBy} />
            )}
            {alert.resolvedAt && (
              <StatusRow label="Resolved at" value={formatDateTime(alert.resolvedAt)} />
            )}
          </div>
        </div>

        {/* Audit trail */}
        <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">
          <div className="border-b border-border-subtle px-5 py-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Audit trail ({alert.audit.length} entries)
            </h3>
          </div>
          <div className="divide-y divide-border-subtle">
            {alert.audit.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text capitalize">{entry.action.replace(/_/g, " ")}</p>
                  {entry.detail && (
                    <p className="mt-0.5 text-xs text-text-secondary truncate">{entry.detail}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-text-muted">{formatDateTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-text-muted">{label}:</span>{" "}
      <span className="font-medium text-text capitalize">{value}</span>
    </p>
  );
}
