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
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="animate-fade-in-scale w-full max-w-[380px] rounded-3xl border border-hairline bg-paper p-8 shadow-subtle">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-canvas ring-1 ring-hairline">
            <Shield size={28} weight="fill" className="text-ink" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">Sentira</h1>
          <p className="mt-1 text-sm text-ink-soft">Camera-free elder monitoring</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-soft">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11 w-full rounded-2xl border border-hairline bg-canvas px-4 text-sm text-ink placeholder:text-mid-gray transition-colors focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink/40"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-2xl bg-ink text-sm font-semibold text-paper transition-all hover:bg-ink-soft active:scale-[0.98] disabled:opacity-50"
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

        <p className="mt-5 text-center text-xs text-mid-gray">
          Demo mode — enter any email to sign in
        </p>
      </div>
    </div>
  );
}
