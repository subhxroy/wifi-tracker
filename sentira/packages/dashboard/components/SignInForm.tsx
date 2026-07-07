"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";

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
    <div className="w-full max-w-sm rounded-2xl bg-surface p-8 ring-1 ring-border">
      <div className="mb-6 text-center">
        <span className="text-2xl text-primary">✦</span>
        <h1 className="mt-2 font-heading text-xl font-semibold text-text">Sentira</h1>
        <p className="mt-1 text-sm text-text-muted">Camera-free elder monitoring</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dim disabled:opacity-50"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-xs text-text-dim text-center">
        Demo mode — enter any email to sign in
      </p>
    </div>
  );
}
