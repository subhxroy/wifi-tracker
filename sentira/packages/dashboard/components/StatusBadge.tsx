import type { AlertSeverity } from "@sentira/types";

const severityStyles: Record<string, string> = {
  HIGH: "bg-ink-soft text-paper",
  MEDIUM: "border border-hairline text-ink bg-paper",
};

const statusStyles: Record<string, string> = {
  alert: "bg-ink-soft text-paper",
  attention: "bg-canvas text-ink-soft",
  normal: "border border-hairline text-ink bg-paper",
  "no-data": "bg-canvas text-mid-gray",
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${severityStyles[severity] ?? ""}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] ?? "bg-canvas text-mid-gray";
  const label = status === "alert" ? "Alert" : status === "attention" ? "Attention" : status === "no-data" ? "No data" : "Normal";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
