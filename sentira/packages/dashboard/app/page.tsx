"use client";

import { useState, useEffect, useCallback } from "react";
import type { OverviewSnapshot, Alert, SseEvent } from "@sentira/types";
import { getOverview } from "@/lib/middleware-api";
import { useSse } from "@/lib/use-sse";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { ResidentCard } from "@/components/ResidentCard";
import { AlertBanner } from "@/components/AlertBanner";
import { SignInForm } from "@/components/SignInForm";
import { Spinner } from "@/components/Spinner";
import { ShieldCheck, WifiHigh, Pulse } from "@phosphor-icons/react";

export default function OverviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState<OverviewSnapshot | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const ov = await getOverview();
      setOverview(ov);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchOverview();
  }, [user, fetchOverview]);

  useSse(
    useCallback((event: SseEvent) => {
      if (event.type === "overview") setOverview(event.overview);
      if (event.type === "alert") setActiveAlerts((prev) => [event.alert, ...prev].slice(0, 20));
    }, []),
    !!user,
  );

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

  const alertResidents = overview?.residents.filter((r) => r.status === "alert") ?? [];
  const attentionResidents = overview?.residents.filter((r) => r.status === "attention") ?? [];
  const normalResidents = overview?.residents.filter((r) => r.status === "normal") ?? [];

  const totalResidents = overview?.residents.length ?? 0;
  const onlineSensors = overview?.residents.filter((r) => r.sensorOnline).length ?? 0;

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-12">
        {/* Page header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="font-heading text-3xl text-text">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">Real-time monitoring overview</p>
        </div>

        {/* Stats row */}
        <div className="mb-8 grid grid-cols-3 gap-4 stagger-children">
          <StatCard
            icon={<ShieldCheck size={18} className="text-primary" />}
            label="Residents"
            value={totalResidents.toString()}
          />
          <StatCard
            icon={<WifiHigh size={18} className="text-success" />}
            label="Sensors online"
            value={`${onlineSensors}/${totalResidents}`}
          />
          <StatCard
            icon={<Pulse size={18} className={alertResidents.length > 0 ? "text-danger" : "text-success"} />}
            label="Active alerts"
            value={alertResidents.length.toString()}
            highlight={alertResidents.length > 0}
          />
        </div>

        {/* Active alerts banner */}
        {alertResidents.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Active alerts</h2>
            <div className="space-y-2">
              {activeAlerts.filter((a) => a.status === "active" || a.status === "escalated").slice(0, 3).map((alert) => (
                <AlertBanner key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}

        {/* Residents grid */}
        <div className="mb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Residents</h2>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size={28} />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-danger/20 bg-danger-muted p-5 text-sm text-danger">
              Could not connect to middleware: {error}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
              {alertResidents.map((r) => (
                <ResidentCard key={r.id} resident={r} />
              ))}
              {attentionResidents.map((r) => (
                <ResidentCard key={r.id} resident={r} />
              ))}
              {normalResidents.map((r) => (
                <ResidentCard key={r.id} resident={r} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {overview && (
          <p className="text-xs text-text-muted">
            Last updated: {new Date(overview.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, highlight = false }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${
      highlight ? "border-danger/20 bg-danger-muted" : "border-border-subtle bg-surface"
    }`}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <p className={`text-2xl font-semibold ${highlight ? "text-danger" : "text-text"}`}>{value}</p>
    </div>
  );
}
