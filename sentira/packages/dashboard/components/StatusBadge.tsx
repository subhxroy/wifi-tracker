import type { AlertSeverity } from "@sentira/types";

const severityStyles: Record<string, string> = {
  HIGH: "bg-danger-bg text-danger border-danger/30",
  MEDIUM: "bg-amber-bg text-amber border-amber/30",
};

const statusStyles: Record<string, string> = {
  alert: "bg-danger-bg text-danger border-danger/30",
  attention: "bg-amber-bg text-amber border-amber/30",
  normal: "bg-green-bg text-green border-green/30",
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${severityStyles[severity] ?? ""}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? "bg-surface-elevated text-text-muted border-border";
  const label = status === "alert" ? "Alert" : status === "attention" ? "Attention" : "Normal";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "alert" ? "bg-danger" : status === "attention" ? "bg-amber" : "bg-green"}`} />
      {label}
    </span>
  );
}
