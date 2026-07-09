"use client";

import { useState, useEffect, useCallback } from "react";
import type { Resident, NodeHealth, Alert } from "@sentira/types";
import { getResidents, getNodes, getAlerts, updateResident } from "@/lib/middleware-api";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SensorHealth } from "@/components/SensorHealth";
import { Spinner } from "@/components/Spinner";
import { SignInForm } from "@/components/SignInForm";
import { formatDateTime } from "@/lib/format";
import { WifiSlash, WifiHigh, User, Envelope, DeviceMobile, Bell, ArrowUp, ArrowDown } from "@phosphor-icons/react";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [nodes, setNodes] = useState<NodeHealth[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [r, n, a] = await Promise.all([getResidents(), getNodes(), getAlerts({ limit: 20 })]);
      setResidents(r);
      setNodes(n);
      setRecentAlerts(a);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleReorder = async (residentId: string, contacts: Resident["escalationChain"]) => {
    setSavingId(residentId);
    try {
      const updated = await updateResident(residentId, { escalationChain: contacts });
      setResidents((prev) => prev.map((r) => (r.id === residentId ? updated : r)));
    } catch (err) {
      console.error("reorder failed", err);
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleChannel = async (residentId: string, channels: Resident["notificationChannels"]) => {
    setSavingId(residentId);
    try {
      const updated = await updateResident(residentId, { notificationChannels: channels });
      setResidents((prev) => prev.map((r) => (r.id === residentId ? updated : r)));
    } catch (err) {
      console.error("toggle failed", err);
    } finally {
      setSavingId(null);
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

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 pt-24 pb-12">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Settings</h1>
          <p className="mt-1 text-sm text-ink-soft">Residents, sensors, and system configuration</p>
        </div>

        {error && (
          <div className="mb-8 rounded-3xl border border-ember/20 bg-paper p-5 text-sm text-ember animate-fade-in shadow-subtle">
            Could not connect to middleware: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={28} />
          </div>
        ) : (
          <div className="space-y-10 stagger-children">
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-mid-gray">Residents &amp; caregivers</h2>
              <div className="space-y-3">
                {residents.length === 0 ? (
                  <div className="rounded-3xl border border-hairline bg-paper p-5 text-sm text-mid-gray">
                    No residents configured
                  </div>
                ) : (
                  residents.map((r) => (
                    <div key={r.id} className="rounded-3xl border border-hairline bg-paper p-5 shadow-subtle">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-canvas">
                            <User size={18} className="text-ink" />
                          </div>
                          <div>
                            <span className="text-base font-semibold text-ink">{r.name}</span>
                            <span className="ml-2 text-sm text-ink-soft">{r.room}</span>
                          </div>
                        </div>
                        {savingId === r.id && <Spinner size={14} />}
                      </div>

                      <div className="mb-4">
                        <h4 className="mb-2 text-xs font-medium text-mid-gray">Escalation chain (reorderable)</h4>
                        <div className="space-y-1.5">
                          {r.escalationChain.map((c, i) => (
                            <div key={c.id} className="flex items-center gap-2 rounded-2xl bg-canvas px-3 py-2 text-sm">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-paper text-[9px] font-semibold text-mid-gray ring-1 ring-hairline">
                                {i + 1}
                              </span>

                              <span className="font-medium text-ink">{c.name}</span>
                              <span className="text-xs text-mid-gray">{c.role}</span>
                              <div className="ml-auto flex gap-1">
                                {i > 0 && (
                                  <button
                                    onClick={() => {
                                      const copy = r.escalationChain.slice();
                                      const a = copy[i - 1];
                                      const b = copy[i];
                                      if (a && b) { copy[i - 1] = b; copy[i] = a; handleReorder(r.id, copy); }
                                    }}
                                    className="rounded p-1 text-mid-gray hover:text-ink hover:bg-paper"
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                )}
                                {i < r.escalationChain.length - 1 && (
                                  <button
                                    onClick={() => {
                                      const copy = r.escalationChain.slice();
                                      const a = copy[i];
                                      const b = copy[i + 1];
                                      if (a && b) { copy[i] = b; copy[i + 1] = a; handleReorder(r.id, copy); }
                                    }}
                                    className="rounded p-1 text-mid-gray hover:text-ink hover:bg-paper"
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-2 text-xs font-medium text-mid-gray">Notification channels</h4>
                        <div className="flex flex-wrap gap-2">
                          <ChannelToggle
                            icon={<Envelope size={12} />}
                            label="SMS"
                            active={r.notificationChannels.sms}
                            onClick={() => handleToggleChannel(r.id, { ...r.notificationChannels, sms: !r.notificationChannels.sms })}
                          />
                          <ChannelToggle
                            icon={<DeviceMobile size={12} />}
                            label="WhatsApp"
                            active={r.notificationChannels.whatsapp}
                            onClick={() => handleToggleChannel(r.id, { ...r.notificationChannels, whatsapp: !r.notificationChannels.whatsapp })}
                          />
                          <ChannelToggle
                            icon={<Bell size={12} />}
                            label="Push"
                            active={r.notificationChannels.push}
                            onClick={() => handleToggleChannel(r.id, { ...r.notificationChannels, push: !r.notificationChannels.push })}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-mid-gray">Sensor nodes</h2>
              <div className="space-y-3">
                {nodes.length === 0 ? (
                  <div className="rounded-3xl border border-hairline bg-paper p-5 text-sm text-mid-gray">
                    No nodes have reported in yet — waiting for first sensor data
                  </div>
                ) : (
                  nodes.map((n) => (
                    <div key={n.nodeId} className="rounded-3xl border border-hairline bg-paper p-5 shadow-subtle">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {n.online ? (
                            <WifiHigh size={16} className="text-ink-soft" />
                          ) : (
                            <WifiSlash size={16} className="text-ember" />
                          )}
                          <span className="text-sm font-medium text-ink">{n.nodeId}</span>
                        </div>
                        <SensorHealth online={n.online} lastSeen={n.lastSeen} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-ink-soft">
                        {n.rssi != null && <span>RSSI: {n.rssi} dBm</span>}
                        {n.breathingRate != null && <span>BR: {n.breathingRate} bpm (trend)</span>}
                        {n.heartRate != null && <span>HR: {n.heartRate} bpm (trend)</span>}
                      </div>
                      <div className="mt-2 text-[10px] text-mid-gray">
                        Last seen: {formatDateTime(n.lastSeen)}
                        {n.lastMotion > 0 ? ` · Last motion: ${formatDateTime(n.lastMotion)}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-mid-gray">Recent alerts</h2>
              <div className="rounded-3xl border border-hairline bg-paper overflow-hidden shadow-subtle">
                {recentAlerts.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-mid-gray">
                    No alerts yet
                  </div>
                ) : (
                  <div className="divide-y divide-hairline">
                    {recentAlerts.slice(0, 10).map((a) => (
                      <div key={a.id} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-canvas">
                        <span className={`h-2 w-2 rounded-full ${a.severity === "HIGH" ? "bg-ink-soft" : "bg-mid-gray"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink">{a.message}</p>
                          <p className="mt-0.5 text-xs text-mid-gray">
                            {a.residentName} · {formatDateTime(a.createdAt)}
                          </p>
                        </div>
                        <span className="text-xs text-mid-gray capitalize">{a.status.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-mid-gray">System</h2>
              <div className="rounded-3xl border border-hairline bg-paper p-5 text-sm text-ink-soft shadow-subtle">
                <p>
                  Sentira v0.1.0 · Middleware:{" "}
                  {process.env.NEXT_PUBLIC_MIDDLEWARE_URL ?? "http://127.0.0.1:4400"}
                </p>
              </div>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function ChannelToggle({ icon, label, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97] ${
        active
          ? "bg-ink-soft text-paper"
          : "bg-canvas text-mid-gray ring-1 ring-hairline hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
