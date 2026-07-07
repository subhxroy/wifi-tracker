import { WifiSlash, WifiHigh } from "@phosphor-icons/react";
import { timeAgo } from "@/lib/format";

export function SensorHealth({ online, lastSeen }: { online: boolean; lastSeen?: number }) {
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green">
        <WifiHigh size={14} weight="fill" />
        <span>Online{lastSeen ? ` · ${timeAgo(lastSeen)}` : ""}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-danger">
      <WifiSlash size={14} weight="fill" />
      <span>Offline{lastSeen ? ` · ${timeAgo(lastSeen)}` : ""}</span>
    </span>
  );
}
