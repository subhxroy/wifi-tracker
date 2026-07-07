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
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <SignInForm />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <div className="flex items-center justify-center pt-24">
          <Spinner />
        </div>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <div className="mx-auto max-w-3xl px-5 pt-24">
          <div className="rounded-xl bg-danger-bg p-4 text-sm text-danger">
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
      <main className="mx-auto max-w-3xl px-5 pt-20 pb-12">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted no-underline transition-colors hover:text-text"
        >
          <ArrowLeft size={14} />
          Back to overview
        </Link>

        <div className="mb-6">
          <div className="mb-2 flex items-center gap-3">
            <SeverityBadge severity={alert.severity} />
            <h1 className="font-heading text-xl font-semibold text-text">
              {alert.type.replace(/_/g, " ")}
            </h1>
          </div>
          <p className="text-sm text-text-muted">
            {alert.residentName} · {alert.room} · {formatDateTime(alert.createdAt)}
          </p>
        </div>

        {/* Message */}
        <div className="mb-6 rounded-xl bg-surface p-5">
          <p className="text-base leading-relaxed text-text">{alert.message}</p>
          {alert.context?.detail && (
            <p className="mt-2 text-sm text-text-muted">{alert.context.detail}</p>
          )}
        </div>

        {/* Vital context */}
        {alert.context && (alert.context.breathingRate || alert.context.heartRate) && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {alert.context.breathingRate && (
              <div className="rounded-xl bg-surface p-4">
                <span className="text-xs text-text-dim">Breathing rate (trend estimate)</span>
                <p className="font-heading text-2xl font-semibold text-text">
                  {alert.context.breathingRate} <span className="text-sm font-normal text-text-muted">bpm</span>
                </p>
              </div>
            )}
            {alert.context.heartRate && (
              <div className="rounded-xl bg-surface p-4">
                <span className="text-xs text-text-dim">Heart rate (trend estimate)</span>
                <p className="font-heading text-2xl font-semibold text-text">
                  {alert.context.heartRate} <span className="text-sm font-normal text-text-muted">bpm</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {isActive && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => doAction("acknowledge", () => acknowledgeAlert(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dim disabled:opacity-50"
            >
              {actionLoading === "acknowledge" ? <Spinner size={14} /> : <CheckCircle size={16} />}
              Acknowledge
            </button>
            <button
              onClick={() => doAction("escalate", () => escalateAlert(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 rounded-lg border border-amber/30 bg-amber-bg px-4 py-2 text-sm font-medium text-amber transition-colors hover:bg-amber/20 disabled:opacity-50"
            >
              {actionLoading === "escalate" ? <Spinner size={14} /> : <CaretDoubleRight size={16} />}
              Escalate now
            </button>
            <button
              onClick={() => doAction("false-alarm", () => markFalseAlarm(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              {actionLoading === "false-alarm" ? <Spinner size={14} /> : <XCircle size={16} />}
              False alarm
            </button>
            <button
              onClick={() => doAction("resolve", () => resolveAlert(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 rounded-lg border border-green/30 bg-green-bg px-4 py-2 text-sm font-medium text-green transition-colors hover:bg-green/20 disabled:opacity-50"
            >
              {actionLoading === "resolve" ? <Spinner size={14} /> : <Check size={16} />}
              Resolve
            </button>
          </div>
        )}

        {/* Status info */}
        <div className="mb-6 rounded-xl bg-surface p-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-dim">Status</h3>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-text-muted">Current status:</span>{" "}
              <span className="font-medium text-text">{alert.status}</span>
            </p>
            {alert.escalationCount > 0 && (
              <p>
                <span className="text-text-muted">Escalation rounds:</span>{" "}
                <span className="font-medium text-text">{alert.escalationCount}</span>
              </p>
            )}
            {alert.acknowledgedAt && (
              <p>
                <span className="text-text-muted">Acknowledged at:</span>{" "}
                <span className="font-medium text-text">{formatDateTime(alert.acknowledgedAt)}</span>
              </p>
            )}
            {alert.acknowledgedBy && (
              <p>
                <span className="text-text-muted">Acknowledged by:</span>{" "}
                <span className="font-medium text-text">{alert.acknowledgedBy}</span>
              </p>
            )}
            {alert.resolvedAt && (
              <p>
                <span className="text-text-muted">Resolved at:</span>{" "}
                <span className="font-medium text-text">{formatDateTime(alert.resolvedAt)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Audit trail */}
        <div className="rounded-xl bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-dim">
              Audit trail ({alert.audit.length} entries)
            </h3>
          </div>
          <div className="divide-y divide-border">
            {alert.audit.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-text-dim" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text">{entry.action.replace(/_/g, " ")}</p>
                  {entry.detail && (
                    <p className="text-xs text-text-muted truncate">{entry.detail}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-text-dim">{formatDateTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
