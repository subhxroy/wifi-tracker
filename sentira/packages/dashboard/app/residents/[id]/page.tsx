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

  if (error || !resident) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <div className="mx-auto max-w-4xl px-6 pt-28">
          <div className="rounded-2xl border border-danger/20 bg-danger-muted p-5 text-sm text-danger">
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
      <main className="mx-auto max-w-4xl px-6 pt-24 pb-12">
        {/* Back */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-muted no-underline transition-colors hover:text-text"
        >
          <ArrowLeft size={14} />
          Back to overview
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between animate-fade-in">
          <div>
            <h1 className="font-heading text-3xl text-text">{resident.name}</h1>
            <p className="mt-1 text-sm text-text-secondary">{resident.room}</p>
          </div>
          <StatusBadge status={activeAlert ? "alert" : "normal"} />
        </div>

        {/* Sensor + Thresholds */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 stagger-children">
          <div className="rounded-2xl border border-border-subtle bg-surface p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Sensor health</h3>
            {node ? (
              <div className="space-y-2 text-sm">
                <SensorHealth online={node.online} lastSeen={node.lastSeen} />
                {node.rssi != null && <p className="text-text-secondary">RSSI: {node.rssi} dBm</p>}
                {node.breathingRate != null && (
                  <p className="text-text-secondary">Breathing: {node.breathingRate} bpm</p>
                )}
                {node.heartRate != null && (
                  <p className="text-text-secondary">Heart rate: {node.heartRate} bpm</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No data yet</p>
            )}
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Thresholds</h3>
            <div className="space-y-1.5 text-sm text-text-secondary">
              <p>Fall confirm: {resident.thresholds.fallConfirmWindowSec}s</p>
              <p>Inactivity (day): {formatDuration(resident.thresholds.inactivityDaySec)}</p>
              <p>Inactivity (night): {formatDuration(resident.thresholds.inactivityNightSec)}</p>
              <p>Breathing range: {resident.thresholds.breathingRange[0]}–{resident.thresholds.breathingRange[1]} bpm</p>
            </div>
          </div>
        </div>

        {/* Active alert */}
        {activeAlert && (
          <div className="mb-8 rounded-2xl border border-danger/20 bg-danger-muted p-5 animate-fade-in">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SeverityBadge severity={activeAlert.severity} />
                <span className="text-sm font-medium text-text capitalize">{activeAlert.type.replace("_", " ")}</span>
              </div>
              <span className="text-xs text-text-muted">{timeAgo(activeAlert.createdAt)}</span>
            </div>
            <p className="mb-4 text-sm text-text">{activeAlert.message}</p>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => handleAck(activeAlert.id)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-canvas transition-all hover:bg-primary-hover active:scale-[0.97]"
              >
                <CheckCircle size={14} />
                Acknowledge
              </button>
              <button
                onClick={() => handleFalseAlarm(activeAlert.id)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-medium text-text-secondary transition-all hover:text-text active:scale-[0.97]"
              >
                <XCircle size={14} />
                False alarm
              </button>
            </div>
          </div>
        )}

        {/* Vital charts */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 stagger-children">
          <VitalTrendChart
            data={breathingData}
            unit="bpm"
            label="Breathing rate"
            range={resident.thresholds.breathingRange}
            color="#d4956a"
          />
          <VitalTrendChart
            data={heartData}
            unit="bpm"
            label="Heart rate"
            range={resident.thresholds.heartRateRange}
            color="#ef5350"
          />
        </div>

        {/* Alert history */}
        <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">
          <div className="border-b border-border-subtle px-5 py-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Alert history ({alerts.length})
            </h3>
          </div>
          {alerts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-text-muted">
              No alerts recorded
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {alerts.slice(0, 30).map((alert) => (
                <div key={alert.id} className="px-5 py-3.5 transition-colors hover:bg-surface-elevated">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-sm font-medium text-text capitalize">{alert.type.replace(/_/g, " ")}</span>
                      <span className="text-xs text-text-muted">{alert.status}</span>
                    </div>
                    <span className="text-xs text-text-muted">{formatDateTime(alert.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">{alert.message}</p>
                  {alert.audit.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {alert.audit.slice(-3).map((entry, i) => (
                        <span key={i} className="rounded-md bg-surface-elevated px-2 py-0.5 text-[10px] text-text-muted capitalize">
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
