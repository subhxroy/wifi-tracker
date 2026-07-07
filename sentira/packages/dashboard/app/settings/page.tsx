"use client";

import { useState, useEffect, useCallback } from "react";
import type { Resident, NodeHealth, Alert } from "@sentira/types";
import { getResidents, getNodes, getAlerts } from "@/lib/middleware-api";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { SensorHealth } from "@/components/SensorHealth";
import { Spinner } from "@/components/Spinner";
import { SignInForm } from "@/components/SignInForm";
import { formatDateTime } from "@/lib/format";
import { WifiSlash, WifiHigh, User, Envelope, DeviceMobile, Bell } from "@phosphor-icons/react";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [nodes, setNodes] = useState<NodeHealth[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [r, n, a] = await Promise.all([getResidents(), getNodes(), getAlerts({ limit: 20 })]);
      setResidents(r);
      setNodes(n);
      setRecentAlerts(a);
    } catch {
      // stub mode
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

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
          <h1 className="font-heading text-3xl text-text">Settings</h1>
          <p className="mt-1 text-sm text-text-secondary">Residents, sensors, and system configuration</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={28} />
          </div>
        ) : (
          <div className="space-y-10 stagger-children">
            {/* Residents */}
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Residents</h2>
              <div className="space-y-3">
                {residents.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-border-subtle bg-surface p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                          <User size={18} className="text-primary" />
                        </div>
                        <div>
                          <span className="font-heading text-base text-text">{r.name}</span>
                          <span className="ml-2 text-sm text-text-secondary">{r.room}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <h4 className="mb-2 text-xs font-medium text-text-muted">Escalation chain</h4>
                        {r.escalationChain.map((c) => (
                          <p key={c.id} className="text-sm text-text-secondary">
                            {c.name} ({c.role}){c.phone ? ` · ${c.phone}` : ""}
                          </p>
                        ))}
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-medium text-text-muted">Channels</h4>
                        <div className="flex gap-3 text-sm">
                          <ChannelBadge icon={<Envelope size={12} />} label="SMS" active={r.notificationChannels.sms} />
                          <ChannelBadge icon={<DeviceMobile size={12} />} label="WhatsApp" active={r.notificationChannels.whatsapp} />
                          <ChannelBadge icon={<Bell size={12} />} label="Push" active={r.notificationChannels.push} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Nodes */}
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Sensor nodes</h2>
              <div className="space-y-3">
                {nodes.length === 0 ? (
                  <div className="rounded-2xl border border-border-subtle bg-surface p-5 text-sm text-text-muted">
                    Waiting for nodes to report...
                  </div>
                ) : (
                  nodes.map((n) => (
                    <div key={n.nodeId} className="rounded-2xl border border-border-subtle bg-surface p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {n.online ? (
                            <WifiHigh size={16} className="text-success" />
                          ) : (
                            <WifiSlash size={16} className="text-danger" />
                          )}
                          <span className="text-sm font-medium text-text">{n.nodeId}</span>
                        </div>
                        <SensorHealth online={n.online} lastSeen={n.lastSeen} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-text-secondary">
                        {n.rssi != null && <span>RSSI: {n.rssi} dBm</span>}
                        {n.breathingRate != null && <span>BR: {n.breathingRate} bpm</span>}
                        {n.heartRate != null && <span>HR: {n.heartRate} bpm</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Recent alerts */}
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Recent alerts</h2>
              <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">
                {recentAlerts.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-text-muted">
                    No alerts yet
                  </div>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {recentAlerts.slice(0, 10).map((a) => (
                      <div key={a.id} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-elevated">
                        <span className={`h-2 w-2 rounded-full ${a.severity === "HIGH" ? "bg-danger" : "bg-warning"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text">{a.message}</p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {a.residentName} · {formatDateTime(a.createdAt)}
                          </p>
                        </div>
                        <span className="text-xs text-text-muted capitalize">{a.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* System */}
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">System</h2>
              <div className="rounded-2xl border border-border-subtle bg-surface p-5 text-sm text-text-secondary">
                <p>
                  Sentira v0.1.0 · Middleware:{" "}
                  {process.env.NEXT_PUBLIC_MIDDLEWARE_URL ?? "http://127.0.0.1:4400"}
                </p>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function ChannelBadge({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
      active ? "bg-success-muted text-success" : "bg-surface-elevated text-text-muted"
    }`}>
      {icon}
      {label}
    </span>
  );
}
