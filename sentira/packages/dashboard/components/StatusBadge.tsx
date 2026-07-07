import type { AlertSeverity } from "@sentira/types";

const severityStyles: Record<string, string> = {
  HIGH: "bg-danger-muted text-danger ring-danger/20",
  MEDIUM: "bg-warning-muted text-warning ring-warning/20",
};

const statusStyles: Record<string, string> = {
  alert: "bg-danger-muted text-danger ring-danger/20",
  attention: "bg-warning-muted text-warning ring-warning/20",
  normal: "bg-success-muted text-success ring-success/20",
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${severityStyles[severity] ?? ""}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? "bg-surface-elevated text-text-muted ring-border";
  const label = status === "alert" ? "Alert" : status === "attention" ? "Attention" : "Normal";
  const dotColor = status === "alert" ? "bg-danger" : status === "attention" ? "bg-warning" : "bg-success";
  const pulseClass = status === "alert" ? "status-pulse-danger" : status === "attention" ? "status-pulse-warning" : "";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${style}`}>
      <span className={`relative h-1.5 w-1.5 rounded-full ${dotColor} ${pulseClass}`} />
      {label}
    </span>
  );
}
