export function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${formatDate(epochMs)} ${formatTime(epochMs)}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function timeAgo(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < 0) return "just now";
  if (diff < 1000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
