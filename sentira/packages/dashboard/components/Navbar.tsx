"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Bell, SignOut, House, Gear } from "@phosphor-icons/react";

export function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-text no-underline">
            <span className="text-xl leading-none text-primary">✦</span>
            <span className="font-heading text-lg font-semibold tracking-tight text-text">
              Sentira
            </span>
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            <NavLink href="/" icon={<House size={16} />} label="Overview" />
            <NavLink href="/settings" icon={<Gear size={16} />} label="Settings" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <>
              <span className="text-sm text-text-muted">{user.name}</span>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
              >
                <SignOut size={16} />
                Sign out
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
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-text-muted no-underline transition-colors hover:bg-surface-elevated hover:text-text"
    >
      {icon}
      {label}
    </Link>
  );
}
