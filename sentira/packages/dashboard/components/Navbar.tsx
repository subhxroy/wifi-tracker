"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { House, Gear, SignOut, Shield } from "@phosphor-icons/react";

export function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 h-16 border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 text-ink no-underline">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper">
              <Shield size={16} weight="fill" className="text-ink" />
            </div>
            <span className="text-lg font-medium tracking-tighter text-ink">sentira</span>
          </Link>
          {user && (
            <div className="hidden items-center gap-1 md:flex">
              <NavLink href="/" icon={<House size={16} />} label="Overview" />
              <NavLink href="/settings" icon={<Gear size={16} />} label="Settings" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-paper text-xs font-medium text-ink-soft">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-ink-soft">{user.name}</span>
              </div>
              <button
                onClick={signOut}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-mid-gray transition-colors hover:bg-paper hover:text-ink"
              >
                <SignOut size={15} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-mid-gray no-underline transition-colors hover:bg-paper hover:text-ink"
    >
      {icon}
      {label}
    </Link>
  );
}
