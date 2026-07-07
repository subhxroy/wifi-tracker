import { WifiSlash, WifiHigh } from "@phosphor-icons/react";
import { timeAgo } from "@/lib/format";

export function SensorHealth({ online, lastSeen }: { online: boolean; lastSeen?: number }) {
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        <WifiHigh size={13} weight="fill" />
        <span>Online{lastSeen ? ` · ${timeAgo(lastSeen)}` : ""}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-danger">
      <WifiSlash size={13} weight="fill" />
      <span>Offline{lastSeen ? ` · ${timeAgo(lastSeen)}` : ""}</span>
    </span>
  );
}
