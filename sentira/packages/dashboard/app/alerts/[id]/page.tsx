"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Alert, SseEvent } from "@sentira/types";
import { getAlert, acknowledgeAlert, escalateAlert, markFalseAlarm, resolveAlert } from "@/lib/middleware-api";
import { useSse } from "@/lib/use-sse";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SeverityBadge } from "@/components/StatusBadge";
import { Spinner } from "@/components/Spinner";
import { SignInForm } from "@/components/SignInForm";
import { formatDateTime } from "@/lib/format";
import { ArrowLeft, CheckCircle, XCircle, CaretDoubleRight, Check } from "@phosphor-icons/react";

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const fetchAlert = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getAlert(id);
      setAlert(data);
      setReconnecting(false);
    } catch (err) {
      if (alert) {
        setReconnecting(true);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (user) fetchAlert();
  }, [user, fetchAlert]);

  useSse(
    useCallback((event: SseEvent) => {
      if (event.type === "alert_updated" && event.alert.id === id) {
        setAlert(event.alert);
        setReconnecting(false);
      }
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
          <div className="rounded-3xl border border-ember/20 bg-paper p-5 text-sm text-ember shadow-subtle">
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
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-mid-gray no-underline transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} />
          Back to overview
        </Link>

        {reconnecting && (
          <div className="mb-4 animate-slide-down rounded-2xl border border-hairline bg-paper px-5 py-2.5 text-xs text-ink shadow-subtle">
            Reconnecting to middleware...
          </div>
        )}

        <div className="mb-6 animate-fade-in">
          <div className="mb-2 flex items-center gap-3">
            <SeverityBadge severity={alert.severity} />
            <h1 className="text-2xl font-semibold tracking-tight text-ink capitalize">
              {alert.type.replace(/_/g, " ")}
            </h1>
          </div>
          <p className="text-sm text-ink-soft">
            {alert.residentName} · {alert.room} · {formatDateTime(alert.createdAt)}
          </p>
        </div>

        <div className="mb-6 rounded-3xl border border-hairline bg-paper p-6 shadow-subtle">
          <p className="text-base leading-relaxed text-ink">{alert.message}</p>
          {alert.context?.detail && (
            <p className="mt-2 text-sm text-ink-soft">{alert.context.detail}</p>
          )}
        </div>

        {alert.context && (alert.context.breathingRate || alert.context.heartRate) && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 stagger-children">
            {alert.context.breathingRate != null && (
              <div className="rounded-3xl border border-hairline bg-paper p-5 shadow-subtle">
                <span className="text-xs text-mid-gray">Breathing rate (trend estimate)</span>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">
                  {alert.context.breathingRate} <span className="text-sm font-normal text-mid-gray">bpm</span>
                </p>
              </div>
            )}
            {alert.context.heartRate != null && (
              <div className="rounded-3xl border border-hairline bg-paper p-5 shadow-subtle">
                <span className="text-xs text-mid-gray">Heart rate (trend estimate)</span>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">
                  {alert.context.heartRate} <span className="text-sm font-normal text-mid-gray">bpm</span>
                </p>
              </div>
            )}
          </div>
        )}

        {isActive && (
          <div className="mb-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap stagger-children">
            <button
              onClick={() => doAction("acknowledge", () => acknowledgeAlert(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-paper transition-all hover:bg-ink-soft active:scale-[0.97] disabled:opacity-50 sm:py-2.5"
            >
              {actionLoading === "acknowledge" ? <Spinner size={14} /> : <CheckCircle size={16} />}
              Acknowledge
            </button>
            <button
              onClick={() => doAction("escalate", () => escalateAlert(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-hairline bg-paper px-5 py-3 text-sm font-medium text-ink transition-all hover:bg-canvas active:scale-[0.97] disabled:opacity-50 sm:py-2.5"
            >
              {actionLoading === "escalate" ? <Spinner size={14} /> : <CaretDoubleRight size={16} />}
              Escalate now
            </button>
            <button
              onClick={() => doAction("false-alarm", () => markFalseAlarm(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-hairline bg-paper px-5 py-3 text-sm font-medium text-ink transition-all hover:bg-canvas active:scale-[0.97] disabled:opacity-50 sm:py-2.5"
            >
              {actionLoading === "false-alarm" ? <Spinner size={14} /> : <XCircle size={16} />}
              False alarm
            </button>
            <button
              onClick={() => doAction("resolve", () => resolveAlert(alert.id))}
              disabled={actionLoading !== null}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-hairline bg-paper px-5 py-3 text-sm font-medium text-ink transition-all hover:bg-canvas active:scale-[0.97] disabled:opacity-50 sm:py-2.5"
            >
              {actionLoading === "resolve" ? <Spinner size={14} /> : <Check size={16} />}
              Resolve
            </button>
          </div>
        )}

        <div className="mb-6 rounded-3xl border border-hairline bg-paper p-5 shadow-subtle">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-mid-gray">Status</h3>
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

        <div className="rounded-3xl border border-hairline bg-paper overflow-hidden shadow-subtle">
          <div className="border-b border-hairline px-5 py-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-mid-gray">
              Audit trail ({alert.audit.length} entries)
            </h3>
          </div>
          <div className="divide-y divide-hairline">
            {alert.audit.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mid-gray" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink capitalize">{entry.action.replace(/_/g, " ")}</p>
                  {entry.detail && (
                    <p className="mt-0.5 text-xs text-ink-soft truncate">{entry.detail}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-mid-gray">{formatDateTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-mid-gray">{label}:</span>{" "}
      <span className="font-medium text-ink capitalize">{value}</span>
    </p>
  );
}
