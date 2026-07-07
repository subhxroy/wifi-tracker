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

  const alertResidents = overview?.residents.filter((r) => r.status === "alert") ?? [];
  const attentionResidents = overview?.residents.filter((r) => r.status === "attention") ?? [];
  const normalResidents = overview?.residents.filter((r) => r.status === "normal") ?? [];

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto max-w-6xl px-5 pt-20 pb-12">
        {/* Active alerts banner */}
        {alertResidents.length > 0 && (
          <div className="mb-6 space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-text-dim">Active alerts</h2>
            {activeAlerts.filter((a) => a.status === "active" || a.status === "escalated").slice(0, 3).map((alert) => (
              <AlertBanner key={alert.id} alert={alert} />
            ))}
          </div>
        )}

        {/* Residents */}
        <div className="mb-6">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-dim">Residents</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : error ? (
            <div className="rounded-xl bg-danger-bg p-4 text-sm text-danger">
              Could not connect to middleware: {error}. Make sure the middleware is running on port 4400.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* System status */}
        {overview && (
          <div className="text-xs text-text-dim">
            Last updated: {new Date(overview.generatedAt).toLocaleTimeString()}
          </div>
        )}
      </main>
    </div>
  );
}
