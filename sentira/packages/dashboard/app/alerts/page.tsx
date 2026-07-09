"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import type { Alert, Resident, SseEvent } from "@sentira/types";
import { getAlerts, getResidents } from "@/lib/middleware-api";
import { useSse } from "@/lib/use-sse";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { SeverityBadge } from "@/components/StatusBadge";
import { Spinner } from "@/components/Spinner";
import { SignInForm } from "@/components/SignInForm";
import { formatDateTime } from "@/lib/format";
import { Bell, BellRinging, CheckCircle, Funnel, CaretDown } from "@phosphor-icons/react";

type SeverityFilter = "all" | "HIGH" | "MEDIUM";
type StatusFilter = "all" | "active" | "resolved";

export default function AlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [residentFilter, setResidentFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchAlerts = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        getAlerts({ includeResolved: true, limit: 200 }),
        getResidents(),
      ]);
      setAlerts(a);
      setResidents(r);
      setError(null);
    } catch (err) {
      if (alerts.length > 0) {
        setReconnecting(true);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [alerts.length]);

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user, fetchAlerts]);

  useSse(
    useCallback((event: SseEvent) => {
      setReconnecting(false);
      if (event.type === "alert") {
        setAlerts((prev) => {
          if (prev.some((a) => a.id === event.alert.id)) return prev;
          return [event.alert, ...prev].slice(0, 300);
        });
      }
      if (event.type === "alert_updated") {
        setAlerts((prev) => prev.map((a) => (a.id === event.alert.id ? event.alert : a)));
      }
    }, []),
    !!user,
  );

  // Filtered list
  const filtered = useMemo(() => {
    let list = alerts;
    if (severityFilter !== "all") list = list.filter((a) => a.severity === severityFilter);
    if (statusFilter === "active") list = list.filter((a) => a.status !== "resolved" && a.status !== "false_alarm");
    if (statusFilter === "resolved") list = list.filter((a) => a.status === "resolved" || a.status === "false_alarm");
    if (residentFilter !== "all") list = list.filter((a) => a.residentId === residentFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.message.toLowerCase().includes(q) ||
          a.residentName.toLowerCase().includes(q) ||
          a.room.toLowerCase().includes(q) ||
          a.type.includes(q),
      );
    }
    return list;
  }, [alerts, severityFilter, statusFilter, residentFilter, search]);

  // Summary stats
  const stats = useMemo(() => {
    const active = alerts.filter((a) => a.status !== "resolved" && a.status !== "false_alarm");
    const resolved = alerts.filter((a) => a.status === "resolved" || a.status === "false_alarm");
    return {
      total: alerts.length,
      active: active.length,
      resolved: resolved.length,
      high: alerts.filter((a) => a.severity === "HIGH").length,
      medium: alerts.filter((a) => a.severity === "MEDIUM").length,
    };
  }, [alerts]);

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
      <main className="mx-auto max-w-5xl px-6 pt-24 pb-12">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Alerts</h1>
          <p className="mt-1 text-sm text-ink-soft">Browse and filter all alert history</p>
        </div>

        {reconnecting && (
          <div className="mb-4 animate-slide-down rounded-2xl border border-hairline bg-paper px-5 py-2.5 text-xs text-ink shadow-subtle">
            Reconnecting to middleware...
          </div>
        )}

        {error && (
          <div className="mb-8 rounded-3xl border border-ember/20 bg-paper p-5 text-sm text-ember animate-fade-in shadow-subtle">
            Could not connect to middleware: {error}
          </div>
        )}

        {!error && (
          <>
            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5 stagger-children">
              <StatPill label="Total" value={stats.total} />
              <StatPill label="Active" value={stats.active} accent />
              <StatPill label="Resolved" value={stats.resolved} />
              <StatPill label="HIGH" value={stats.high} />
              <StatPill label="MEDIUM" value={stats.medium} />
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-3 animate-fade-in">
              <div className="flex items-center gap-1.5 text-xs text-mid-gray">
                <Funnel size={13} />
                <span>Filter:</span>
              </div>

              <FilterButton
                label="Severity"
                value={severityFilter === "all" ? "All" : severityFilter}
                options={(["all", "HIGH", "MEDIUM"] as SeverityFilter[]).map((v) => ({
                  value: v,
                  label: v === "all" ? "All" : v,
                }))}
                selected={severityFilter}
                onChange={setSeverityFilter}
              />

              <FilterButton
                label="Status"
                value={statusFilter === "all" ? "All" : statusFilter === "active" ? "Active" : "Resolved"}
                options={(["all", "active", "resolved"] as StatusFilter[]).map((v) => ({
                  value: v,
                  label: v === "all" ? "All" : v === "active" ? "Active" : "Resolved",
                }))}
                selected={statusFilter}
                onChange={setStatusFilter}
              />

              <select
                value={residentFilter}
                onChange={(e) => setResidentFilter(e.target.value)}
                className="rounded-2xl border border-hairline bg-paper px-3 py-1.5 text-xs text-ink shadow-subtle focus:outline-none focus:ring-1 focus:ring-hairline"
              >
                <option value="all">All residents</option>
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.room})
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Search alerts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ml-auto rounded-2xl border border-hairline bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-mid-gray shadow-subtle focus:outline-none focus:ring-1 focus:ring-hairline"
              />
            </div>

            {/* Alert list */}
            <div className="rounded-3xl border border-hairline bg-paper overflow-hidden shadow-subtle">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Spinner size={28} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-canvas">
                    <Bell size={18} className="text-mid-gray" />
                  </div>
                  <p className="text-sm text-mid-gray">
                    {alerts.length === 0 ? "No alerts recorded yet" : "No alerts match the current filters"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-hairline">
                  {filtered.map((alert) => {
                    const isResolved = alert.status === "resolved" || alert.status === "false_alarm";
                    return (
                      <Link
                        key={alert.id}
                        href={`/alerts/${alert.id}`}
                        className="block px-5 py-3.5 transition-colors hover:bg-canvas no-underline"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <SeverityBadge severity={alert.severity} />
                            <span className="text-sm font-medium text-ink capitalize truncate">
                              {alert.type.replace(/_/g, " ")}
                            </span>
                            <span
                              className={`text-xs ${
                                isResolved ? "text-mid-gray" : alert.status === "escalated" ? "text-ember" : "text-ink-soft"
                              }`}
                            >
                              {alert.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs text-mid-gray">{formatDateTime(alert.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-ink-soft truncate">{alert.message}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-mid-gray">
                          <span>{alert.residentName}</span>
                          <span>·</span>
                          <span>{alert.room}</span>
                          {alert.escalationCount > 0 && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5">
                                <BellRinging size={10} />
                                Escalated {alert.escalationCount}x
                              </span>
                            </>
                          )}
                          {isResolved && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5">
                                <CheckCircle size={10} />
                                Resolved
                              </span>
                            </>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {!loading && filtered.length > 0 && (
              <p className="mt-3 text-xs text-mid-gray">
                Showing {filtered.length} of {alerts.length} alerts
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatPill({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-subtle ${
        accent ? "bg-paper border border-ember/20" : "bg-paper border border-hairline"
      }`}
    >
      <span className="text-[10px] uppercase tracking-wider text-mid-gray">{label}</span>
      <p className={`text-xl font-semibold tracking-tight ${accent ? "text-ember" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function FilterButton<T extends string>({
  label,
  value,
  options,
  selected,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: T; label: string }[];
  selected: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="relative inline-flex items-center gap-1">
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none rounded-2xl border border-hairline bg-paper pl-3 pr-7 py-1.5 text-xs font-medium text-ink shadow-subtle focus:outline-none focus:ring-1 focus:ring-hairline"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
      <CaretDown size={10} className="pointer-events-none absolute right-2.5 text-mid-gray" />
    </div>
  );
}
