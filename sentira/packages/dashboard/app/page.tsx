"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { OverviewSnapshot, Alert, SseEvent } from "@sentira/types";
import { getOverview, getAlerts } from "@/lib/middleware-api";
import { useSse } from "@/lib/use-sse";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ResidentCard } from "@/components/ResidentCard";
import { AlertBanner } from "@/components/AlertBanner";
import { SignInForm } from "@/components/SignInForm";
import { Spinner } from "@/components/Spinner";
import { ShieldCheck, WifiHigh, Pulse, Plus } from "@phosphor-icons/react";

const STATUS_ORDER: Record<string, number> = { alert: 0, attention: 1, normal: 2 };

export default function OverviewPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<OverviewSnapshot | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const [ov, alerts] = await Promise.all([getOverview(), getAlerts({ limit: 10 })]);
      setOverview(ov);
      setActiveAlerts(alerts.filter((a) => a.status === "active" || a.status === "escalated"));
      setError(null);
    } catch (err) {
      if (overview) {
        setReconnecting(true);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [overview]);

  useEffect(() => {
    if (user) fetchOverview();
  }, [user, fetchOverview]);

  useSse(
    useCallback((event: SseEvent) => {
      if (event.type === "overview") {
        setOverview(event.overview);
        setReconnecting(false);
      }
      if (event.type === "alert") setActiveAlerts((prev) => {
        if (prev.some((a) => a.id === event.alert.id)) return prev;
        return [event.alert, ...prev].slice(0, 20);
      });
    }, []),
    !!user,
  );

  const sortedResidents = useMemo(
    () => (overview?.residents ?? []).slice().sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)),
    [overview],
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
  const normalResidents = overview?.residents.filter((r) => r.status === "normal") ?? [];

  const totalResidents = overview?.residents.length ?? 0;
  const onlineSensors = overview?.residents.filter((r) => r.sensorOnline).length ?? 0;

  if (!loading && totalResidents === 0 && !error) {
    return (
      <div className="min-h-screen bg-canvas">
        <Navbar />
        <main className="mx-auto max-w-6xl px-6 pt-24 pb-12">
          <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-canvas ring-1 ring-hairline">
              <ShieldCheck size={28} className="text-ink" />
            </div>
            <h2 className="text-xl font-semibold text-ink">No residents yet</h2>
            <p className="mt-2 text-sm text-ink-soft text-center max-w-sm">
              Add your first resident to start monitoring. Residents appear here once configured in the middleware.
            </p>
            <button onClick={() => router.push("/settings")} className="mt-6 flex items-center gap-2 rounded-2xl bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-all hover:bg-ink-soft active:scale-[0.97]">
              <Plus size={16} />
              Add resident
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pt-24 pb-12">
        {reconnecting && (
          <div className="mb-4 animate-slide-down rounded-2xl border border-hairline bg-paper px-5 py-2.5 text-xs text-ink shadow-subtle">
            Reconnecting to middleware...
          </div>
        )}

        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-soft">Real-time monitoring overview</p>
        </div>

        {error && (
          <div className="mb-8 rounded-3xl border border-ember/20 bg-paper p-5 text-sm text-ember animate-fade-in shadow-subtle">
            Could not connect to middleware: {error}
          </div>
        )}

        {!error && (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6 stagger-children">
            <StatCard
              icon={<ShieldCheck size={18} className="text-ink" />}
              label="Residents"
              value={totalResidents.toString()}
            />
            <StatCard
              icon={<WifiHigh size={18} className="text-ink" />}
              label="Sensors online"
              value={`${onlineSensors}/${totalResidents}`}
            />
            <StatCard
              icon={<Pulse size={18} className={alertResidents.length > 0 ? "text-ember" : "text-ink"} />}
              label="Active alerts"
              value={alertResidents.length.toString()}
              highlight={alertResidents.length > 0}
            />
          </div>
        )}

        {alertResidents.length > 0 && !error && (
          <div className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-mid-gray">Active alerts</h2>
            <div className="space-y-2">
              {activeAlerts.filter((a) => a.status === "active" || a.status === "escalated").slice(0, 3).map((alert) => (
                <AlertBanner key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-mid-gray">Residents</h2>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size={28} />
            </div>
          ) : !sortedResidents.length && !error ? null : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 stagger-children">
              {sortedResidents.map((r) => (
                <ResidentCard key={r.id} resident={r} />
              ))}
            </div>
          )}
        </div>

        {normalResidents.length === sortedResidents.length && sortedResidents.length > 0 && (
          <p className="text-xs text-mid-gray text-center py-4">
            All residents are in a normal state — no active alerts.
          </p>
        )}

        {overview && (
          <p className="text-xs text-mid-gray">
            Last updated: {new Date(overview.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}

function StatCard({ icon, label, value, highlight = false }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-3xl p-6 shadow-subtle ${
      highlight
        ? "bg-paper border border-ember/20"
        : "bg-paper border border-hairline"
    }`}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <span className="text-xs text-mid-gray">{label}</span>
      </div>
      <p className={`text-3xl font-semibold tracking-tight ${highlight ? "text-ember" : "text-ink"}`}>{value}</p>
    </div>
  );
}
