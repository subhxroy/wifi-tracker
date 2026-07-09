import { WifiSlash, WifiHigh } from "@phosphor-icons/react";
import { timeAgo } from "@/lib/format";

export function SensorHealth({ online, lastSeen }: { online: boolean; lastSeen?: number }) {
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
        <WifiHigh size={13} weight="fill" />
        <span>Online{lastSeen ? ` · ${timeAgo(lastSeen)}` : ""}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ember">
      <WifiSlash size={13} weight="fill" />
      <span>Offline{lastSeen ? ` · ${timeAgo(lastSeen)}` : ""}</span>
    </span>
  );
}
