"use client";

import { useState, useEffect, useCallback } from "react";
import type { Resident, NodeHealth, Alert } from "@sentira/types";
import { getResidents, getNodes, getAlerts, updateResident } from "@/lib/middleware-api";
import { useAuth } from "@/lib/auth";
import { useSse } from "@/lib/use-sse";
import { Navbar } from "@/components/Navbar";
import { SensorHealth } from "@/components/SensorHealth";
import { Spinner } from "@/components/Spinner";
import { SignInForm } from "@/components/SignInForm";
import { formatDateTime } from "@/lib/format";
import { WifiSlash, WifiHigh, User } from "@phosphor-icons/react";

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

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-4xl px-5 pt-20 pb-12">
        <h1 className="mb-6 font-heading text-2xl font-semibold text-text">Settings</h1>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Residents */}
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-dim">Residents</h2>
              <div className="space-y-3">
                {residents.map((r) => (
                  <div key={r.id} className="rounded-xl bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-primary" />
                        <span className="font-heading text-base font-medium text-text">{r.name}</span>
                        <span className="text-sm text-text-muted">{r.room}</span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <h4 className="mb-1 text-xs text-text-dim">Escalation chain</h4>
                        {r.escalationChain.map((c) => (
                          <p key={c.id} className="text-sm text-text-muted">
                            {c.name} ({c.role}){c.phone ? ` · ${c.phone}` : ""}
                          </p>
                        ))}
                      </div>
                      <div>
                        <h4 className="mb-1 text-xs text-text-dim">Channels</h4>
                        <div className="flex gap-2 text-sm text-text-muted">
                          <span>SMS: {r.notificationChannels.sms ? "ON" : "OFF"}</span>
                          <span>WhatsApp: {r.notificationChannels.whatsapp ? "ON" : "OFF"}</span>
                          <span>Push: {r.notificationChannels.push ? "ON" : "OFF"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Nodes / hardware health */}
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-dim">Sensor nodes</h2>
              <div className="space-y-3">
                {nodes.length === 0 ? (
                  <div className="rounded-xl bg-surface p-4 text-sm text-text-muted">
                    Waiting for nodes to report...
                  </div>
                ) : (
                  nodes.map((n) => (
                    <div key={n.nodeId} className="rounded-xl bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {n.online ? (
                            <WifiHigh size={16} className="text-green" />
                          ) : (
                            <WifiSlash size={16} className="text-danger" />
                          )}
                          <span className="text-sm font-medium text-text">{n.nodeId}</span>
                        </div>
                        <SensorHealth online={n.online} lastSeen={n.lastSeen} />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-text-muted">
                        {n.rssi && <span>RSSI: {n.rssi} dBm</span>}
                        {n.breathingRate && <span>BR: {n.breathingRate} bpm</span>}
                        {n.heartRate && <span>HR: {n.heartRate} bpm</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Recent alerts */}
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-dim">Recent alerts</h2>
              <div className="rounded-xl bg-surface">
                {recentAlerts.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-text-muted">
                    No alerts yet
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentAlerts.slice(0, 10).map((a) => (
                      <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                        <span className={`h-2 w-2 rounded-full ${a.severity === "HIGH" ? "bg-danger" : "bg-amber"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text">{a.message}</p>
                          <p className="text-xs text-text-muted">
                            {a.residentName} · {formatDateTime(a.createdAt)}
                          </p>
                        </div>
                        <span className="text-xs text-text-dim">{a.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Environment info */}
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-dim">System</h2>
              <div className="rounded-xl bg-surface p-4 text-sm text-text-muted">
                <p>
                  Sentira v0.1.0 ·
                  Middleware: {process.env.NEXT_PUBLIC_MIDDLEWARE_URL ?? "http://127.0.0.1:4400"}
                </p>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
