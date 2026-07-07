"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { House, Gear, SignOut, Shield } from "@phosphor-icons/react";

export function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50 h-16 border-b border-border-subtle">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 text-text no-underline">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <Shield size={16} weight="fill" className="text-primary" />
            </div>
            <span className="font-heading text-lg text-text">Sentira</span>
          </Link>
          {/* Nav links */}
          <div className="hidden items-center gap-1 md:flex">
            <NavLink href="/" icon={<House size={16} />} label="Overview" />
            <NavLink href="/settings" icon={<Gear size={16} />} label="Settings" />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user && (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-elevated text-xs font-semibold text-text-secondary">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-text-secondary">{user.name}</span>
              </div>
              <button
                onClick={signOut}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
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
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-text-muted no-underline transition-colors hover:bg-surface-elevated hover:text-text"
    >
      {icon}
      {label}
    </Link>
  );
}
