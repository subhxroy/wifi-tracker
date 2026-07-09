"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Resident, NodeHealth, Alert, SseEvent, ActivityEvent } from "@sentira/types";
import { getResidentDetail, getNodeActivity, updateResident } from "@/lib/middleware-api";
import { useSse } from "@/lib/use-sse";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { StatusBadge, SeverityBadge } from "@/components/StatusBadge";
import { SensorHealth } from "@/components/SensorHealth";
import { VitalTrendChart } from "@/components/VitalTrendChart";
import { Spinner } from "@/components/Spinner";
import { SignInForm } from "@/components/SignInForm";
import { formatTime, formatDateTime, formatDuration, timeAgo } from "@/lib/format";
import { ArrowLeft, CheckCircle, XCircle, Person } from "@phosphor-icons/react";
import { acknowledgeAlert, markFalseAlarm } from "@/lib/middleware-api";

export default function ResidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [resident, setResident] = useState<Resident | null>(null);
  const [nodes, setNodes] = useState<NodeHealth[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getResidentDetail(id);
      setResident(data.resident);
      setNodes(data.nodes);
      setAlerts(data.recentAlerts);
      if (data.nodes.length > 0 && data.nodes[0]) {
        const nodeId = data.nodes[0].nodeId;
        const events = await getNodeActivity(nodeId, Date.now() - 86400000);
        setActivityEvents(events);
      }
    } catch (err) {
      if (resident) {
        setReconnecting(true);
      } else {
        setError((err as Error).message);
      }
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
        setReconnecting(false);
        if (resident && (event.type === "alert" && event.alert.residentId === resident.id)) {
          setAlerts((prev) => {
            if (prev.some((a) => a.id === event.alert.id)) return prev;
            return [event.alert, ...prev].slice(0, 50);
          });
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

  const handleUpdateThreshold = async (field: string, value: unknown) => {
    if (!resident) return;
    setSaving(true);
    try {
      const updated = await updateResident(resident.id, {
        thresholds: { ...resident.thresholds, [field]: value },
      });
      setResident(updated);
    } catch (err) {
      console.error("update failed", err);
    } finally {
      setSaving(false);
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
          <div className="rounded-3xl border border-ember/20 bg-paper p-5 text-sm text-ember shadow-subtle">
            {error ?? "Resident not found"}
          </div>
        </div>
      </div>
    );
  }

  const activeAlert = alerts.find((a) => a.status === "active" || a.status === "escalated");
  const node = nodes[0];

  const breathingData = alerts
    .filter((a): a is Alert & { context: NonNullable<Alert["context"]> & { breathingRate: number } } => typeof a.context?.breathingRate === "number")
    .slice(-20)
    .map((a) => ({ t: a.createdAt, v: a.context.breathingRate }));

  const heartData = alerts
    .filter((a): a is Alert & { context: NonNullable<Alert["context"]> & { heartRate: number } } => typeof a.context?.heartRate === "number")
    .slice(-20)
    .map((a) => ({ t: a.createdAt, v: a.context.heartRate }));

  const recentActivity = activityEvents.slice(-100).reverse();

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 pt-24 pb-12">
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

        <div className="mb-8 flex items-start justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">{resident.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">{resident.room}</p>
          </div>
          <StatusBadge status={activeAlert ? "alert" : "normal"} />
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 stagger-children">
          <div className="rounded-3xl border border-hairline bg-paper p-5 shadow-subtle">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-mid-gray">Sensor health</h3>
            {node ? (
              <div className="space-y-2 text-sm">
                <SensorHealth online={node.online} lastSeen={node.lastSeen} />
                {node.rssi != null && <p className="text-ink-soft">RSSI: {node.rssi} dBm</p>}
                {node.breathingRate != null && (
                  <p className="text-ink-soft">Breathing: {node.breathingRate} bpm (trend estimate)</p>
                )}
                {node.heartRate != null && (
                  <p className="text-ink-soft">Heart rate: {node.heartRate} bpm (trend estimate)</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-mid-gray">No sensor data received yet</p>
            )}
          </div>
          <div className="rounded-3xl border border-hairline bg-paper p-5 shadow-subtle">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-mid-gray">Thresholds (editable)</h3>
            <div className="space-y-2 text-sm text-ink-soft">
              <ThresholdRow
                label="Fall confirm window"
                value={`${resident.thresholds.fallConfirmWindowSec}s`}
                onSave={(v) => handleUpdateThreshold("fallConfirmWindowSec", parseInt(v))}
                saving={saving}
              />
              <ThresholdRow
                label="Inactivity (day)"
                value={formatDuration(resident.thresholds.inactivityDaySec)}
                raw={String(resident.thresholds.inactivityDaySec)}
                onSave={(v) => handleUpdateThreshold("inactivityDaySec", parseInt(v))}
                saving={saving}
              />
              <ThresholdRow
                label="Inactivity (night)"
                value={formatDuration(resident.thresholds.inactivityNightSec)}
                raw={String(resident.thresholds.inactivityNightSec)}
                onSave={(v) => handleUpdateThreshold("inactivityNightSec", parseInt(v))}
                saving={saving}
              />
              <ThresholdRow
                label="Breathing range"
                value={`${resident.thresholds.breathingRange[0]}–${resident.thresholds.breathingRange[1]} bpm`}
                onSave={(v) => {
                  const normalized = v.replace(/[–—~]/g, "-");
                  const [loStr, hiStr] = normalized.split("-");
                  const lo = Number(loStr);
                  const hi = Number(hiStr);
                  if (!isNaN(lo) && !isNaN(hi)) {
                    handleUpdateThreshold("breathingRange", [lo, hi]);
                  }
                }}
                saving={saving}
              />
              <ThresholdRow
                label="Heart rate range"
                value={`${resident.thresholds.heartRateRange[0]}–${resident.thresholds.heartRateRange[1]} bpm`}
                onSave={(v) => {
                  const normalized = v.replace(/[–—~]/g, "-");
                  const [loStr, hiStr] = normalized.split("-");
                  const lo = Number(loStr);
                  const hi = Number(hiStr);
                  if (!isNaN(lo) && !isNaN(hi)) {
                    handleUpdateThreshold("heartRateRange", [lo, hi]);
                  }
                }}
                saving={saving}
              />
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-3xl border border-hairline bg-paper p-5 shadow-subtle stagger-children">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-mid-gray">Escalation contacts</h3>
          {resident.escalationChain.length === 0 ? (
            <p className="text-sm text-mid-gray">No contacts configured</p>
          ) : (
            <div className="space-y-3">
              {resident.escalationChain.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas text-[10px] font-semibold text-mid-gray ring-1 ring-hairline">
                    {i + 1}
                  </span>
                  <Person size={16} className="text-mid-gray shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink font-medium">{c.name}</p>
                    <p className="text-xs text-mid-gray">{c.role}{c.phone ? ` · ${c.phone}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {activeAlert && (
          <div className="mb-8 rounded-3xl border border-ember/20 bg-paper p-5 animate-fade-in shadow-subtle">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SeverityBadge severity={activeAlert.severity} />
                <span className="text-sm font-medium text-ink capitalize">{activeAlert.type.replace(/_/g, " ")}</span>
              </div>
              <span className="text-xs text-mid-gray">{timeAgo(activeAlert.createdAt)}</span>
            </div>
            <p className="mb-4 text-sm text-ink">{activeAlert.message}</p>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => handleAck(activeAlert.id)}
                className="flex items-center gap-1.5 rounded-2xl bg-ink px-4 py-2 text-xs font-semibold text-paper transition-all hover:bg-ink-soft active:scale-[0.97]"
              >
                <CheckCircle size={14} />
                Acknowledge
              </button>
              <button
                onClick={() => handleFalseAlarm(activeAlert.id)}
                className="flex items-center gap-1.5 rounded-2xl border border-hairline bg-paper px-4 py-2 text-xs font-medium text-ink transition-all hover:bg-canvas active:scale-[0.97]"
              >
                <XCircle size={14} />
                False alarm
              </button>
            </div>
          </div>
        )}

        {node && (
          <div className="mb-8 rounded-3xl border border-hairline bg-paper overflow-hidden shadow-subtle">
            <div className="border-b border-hairline px-5 py-3.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-mid-gray">
                Activity timeline — last 24h
              </h3>
            </div>
            <div className="max-h-72 overflow-y-auto overscroll-contain">
              {recentActivity.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-mid-gray">
                  No activity events recorded yet — waiting for sensor data
                </div>
              ) : (
                <div className="relative px-5 py-4">
                  <div className="absolute left-8 top-0 bottom-0 w-px bg-hairline" />
                  <div className="space-y-3">
                    {recentActivity.map((ev, i) => (
                      <div key={i} className="relative flex items-start gap-3">
                        <div className="relative z-10 mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-canvas ring-1 ring-hairline">
                          <div className="h-2 w-2 rounded-full bg-ink-soft" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink">{ev.detail}</p>
                          <p className="text-xs text-mid-gray">{formatTime(ev.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 stagger-children">
          <VitalTrendChart
            data={breathingData}
            unit="bpm"
            label="Breathing rate (trend estimate)"
            range={resident.thresholds.breathingRange}
          />
          <VitalTrendChart
            data={heartData}
            unit="bpm"
            label="Heart rate (trend estimate)"
            range={resident.thresholds.heartRateRange}
          />
        </div>

        <div className="rounded-3xl border border-hairline bg-paper overflow-hidden shadow-subtle">
          <div className="border-b border-hairline px-5 py-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-mid-gray">
              Alert history ({alerts.length})
            </h3>
          </div>
          {alerts.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-mid-gray">
              No alerts recorded for this resident
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {alerts.slice(0, 30).map((alert) => {
                const ackEntry = alert.audit.find((e) => e.action === "acknowledged");
                const falseAlarmEntry = alert.audit.find((e) => e.action === "marked_false_alarm");
                return (
                  <Link
                    key={alert.id}
                    href={`/alerts/${alert.id}`}
                    className="block px-5 py-3.5 transition-colors hover:bg-canvas no-underline"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <SeverityBadge severity={alert.severity} />
                        <span className="text-sm font-medium text-ink capitalize">{alert.type.replace(/_/g, " ")}</span>
                        <span className={`text-xs ${
                          alert.status === "false_alarm" || alert.status === "resolved" ? "text-mid-gray" : "text-mid-gray"
                        }`}>{alert.status.replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-xs text-mid-gray">{formatDateTime(alert.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">{alert.message}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-mid-gray">
                      {ackEntry && (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle size={10} className="text-ink-soft" />
                          Acked by {ackEntry.actor === "dashboard_user" ? "caregiver" : ackEntry.actor} {ackEntry.timestamp ? `· ${formatTime(ackEntry.timestamp)}` : ""}
                        </span>
                      )}
                      {falseAlarmEntry && (
                        <span className="inline-flex items-center gap-1">
                          <XCircle size={10} className="text-mid-gray" />
                          Marked false alarm
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ThresholdRow({ label, value, raw, onSave, saving }: {
  label: string;
  value: string;
  raw?: string;
  onSave: (v: string) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(raw ?? value.replace(/[^0-9–-]/g, ""));

  const handleSave = () => {
    onSave(input);
    setEditing(false);
  };

  return (
    <p className="flex items-center justify-between gap-2 group">
      <span className="text-mid-gray">{label}:</span>
      {editing ? (
        <span className="flex items-center gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-24 rounded-md border border-hairline bg-canvas px-2 py-0.5 text-xs text-ink"
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-ink px-2 py-0.5 text-[10px] font-medium text-paper hover:bg-ink-soft disabled:opacity-50"
          >
            {saving ? "..." : "Save"}
          </button>
        </span>
      ) : (
        <button
          onClick={() => { setInput(raw ?? value); setEditing(true); }}
          className="font-medium text-ink transition-colors hover:text-ink-soft"
        >
          {value}
        </button>
      )}
    </p>
  );
}
