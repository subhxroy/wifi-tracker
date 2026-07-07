"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Shield } from "@phosphor-icons/react";

export function SignInForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    await signIn(email);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-canvas via-canvas-subtle to-surface" />
      <div className="absolute top-1/4 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.04] blur-[120px]" />

      {/* Card */}
      <div className="animate-fade-in-scale relative w-full max-w-[380px] rounded-2xl border border-border-subtle bg-surface/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Shield size={28} weight="fill" className="text-primary" />
          </div>
          <h1 className="font-heading text-2xl text-text">Sentira</h1>
          <p className="mt-1 text-sm text-text-secondary">Camera-free elder monitoring</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 w-full rounded-xl border border-border bg-canvas px-4 text-sm text-text placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-canvas transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                  <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-text-muted">
          Demo mode — enter any email to sign in
        </p>
      </div>
    </div>
  );
}
