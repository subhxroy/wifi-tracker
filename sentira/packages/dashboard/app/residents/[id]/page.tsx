"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Resident, NodeHealth, Alert, SseEvent } from "@sentira/types";
import { getResidentDetail } from "@/lib/middleware-api";
import { useSse } from "@/lib/use-sse";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { StatusBadge, SeverityBadge } from "@/components/StatusBadge";
import { SensorHealth } from "@/components/SensorHealth";
import { VitalTrendChart } from "@/components/VitalTrendChart";
import { Spinner } from "@/components/Spinner";
import { SignInForm } from "@/components/SignInForm";
import { formatTime, formatDateTime, formatDuration, timeAgo } from "@/lib/format";
import { ArrowLeft, CheckCircle, XCircle } from "@phosphor-icons/react";
import { acknowledgeAlert, markFalseAlarm } from "@/lib/middleware-api";

export default function ResidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [resident, setResident] = useState<Resident | null>(null);
  const [nodes, setNodes] = useState<NodeHealth[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getResidentDetail(id);
      setResident(data.resident);
      setNodes(data.nodes);
      setAlerts(data.recentAlerts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  useSse(
    useCallback(
      (event: SseEvent) => {
        if (resident && (event.type === "alert" && event.alert.residentId === resident.id)) {
          setAlerts((prev) => [event.alert, ...prev].slice(0, 50));
        }
        if (event.type === "alert_updated" && resident && event.alert.residentId === resident.id) {
          setAlerts((prev) => prev.map((a) => (a.id === event.alert.id ? event.alert : a)));
        }
      },
      [resident],
    ),
    !!user && !!resident,
  );

  const handleAck = async (alertId: string) => {
    try {
      const updated = await acknowledgeAlert(alertId);
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      console.error("ack failed", err);
    }
  };

  const handleFalseAlarm = async (alertId: string) => {
    try {
      const updated = await markFalseAlarm(alertId);
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      console.error("false alarm failed", err);
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

  if (error || !resident) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <div className="mx-auto max-w-4xl px-5 pt-24">
          <div className="rounded-xl bg-danger-bg p-4 text-sm text-danger">
            {error ?? "Resident not found"}
          </div>
        </div>
      </div>
    );
  }

  const activeAlert = alerts.find((a) => a.status === "active" || a.status === "escalated");
  const node = nodes[0];
  const breathingData = node
    ? alerts
        .filter((a) => a.context?.breathingRate)
        .slice(-20)
        .map((a) => ({ t: a.createdAt, v: a.context!.breathingRate! }))
    : [];

  const heartData = node
    ? alerts
        .filter((a) => a.context?.heartRate)
        .slice(-20)
        .map((a) => ({ t: a.createdAt, v: a.context!.heartRate! }))
    : [];

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-4xl px-5 pt-20 pb-12">
        {/* Back link */}
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted no-underline transition-colors hover:text-text"
        >
          <ArrowLeft size={14} />
          Back to overview
        </Link>

        {/* Resident header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-text">{resident.name}</h1>
            <p className="text-sm text-text-muted">{resident.room}</p>
          </div>
          <StatusBadge status={activeAlert ? "alert" : "normal"} />
        </div>

        {/* Sensor health + thresholds summary */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-surface p-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-dim">Sensor health</h3>
            {node ? (
              <div className="space-y-1.5 text-sm">
                <SensorHealth online={node.online} lastSeen={node.lastSeen} />
                {node.rssi && <p className="text-text-muted">RSSI: {node.rssi} dBm</p>}
                {node.breathingRate && (
                  <p className="text-text-muted">Breathing: {node.breathingRate} bpm</p>
                )}
                {node.heartRate && (
                  <p className="text-text-muted">Heart rate: {node.heartRate} bpm</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No data yet</p>
            )}
          </div>
          <div className="rounded-xl bg-surface p-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-dim">Thresholds</h3>
            <div className="space-y-1 text-sm text-text-muted">
              <p>Fall confirm: {resident.thresholds.fallConfirmWindowSec}s</p>
              <p>Inactivity (day): {formatDuration(resident.thresholds.inactivityDaySec)}</p>
              <p>Inactivity (night): {formatDuration(resident.thresholds.inactivityNightSec)}</p>
              <p>Breathing range: {resident.thresholds.breathingRange[0]}–{resident.thresholds.breathingRange[1]} bpm</p>
            </div>
          </div>
        </div>

        {/* Active alert */}
        {activeAlert && (
          <div className="mb-6 rounded-xl border border-danger/30 bg-danger-bg p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={activeAlert.severity} />
                <span className="text-sm font-medium text-text">{activeAlert.type.replace("_", " ")}</span>
              </div>
              <span className="text-xs text-text-muted">{timeAgo(activeAlert.createdAt)}</span>
            </div>
            <p className="mb-3 text-sm text-text">{activeAlert.message}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAck(activeAlert.id)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-dim"
              >
                <CheckCircle size={14} />
                Acknowledge
              </button>
              <button
                onClick={() => handleFalseAlarm(activeAlert.id)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text"
              >
                <XCircle size={14} />
                False alarm
              </button>
            </div>
          </div>
        )}

        {/* Vital trend charts */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <VitalTrendChart
            data={breathingData}
            unit="bpm"
            label="Breathing rate"
            range={resident.thresholds.breathingRange}
            color="#8b7cf6"
          />
          <VitalTrendChart
            data={heartData}
            unit="bpm"
            label="Heart rate"
            range={resident.thresholds.heartRateRange}
            color="#f04a5e"
          />
        </div>

        {/* Alert history */}
        <div className="rounded-xl bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-dim">
              Alert history ({alerts.length})
            </h3>
          </div>
          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              No alerts recorded
            </div>
          ) : (
            <div className="divide-y divide-border">
              {alerts.slice(0, 30).map((alert) => (
                <div key={alert.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-sm font-medium text-text">{alert.type.replace(/_/g, " ")}</span>
                      <span className="text-xs text-text-dim">{alert.status}</span>
                    </div>
                    <span className="text-xs text-text-muted">{formatDateTime(alert.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{alert.message}</p>
                  {alert.audit.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {alert.audit.slice(-3).map((entry, i) => (
                        <span key={i} className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-text-dim">
                          {entry.action.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
