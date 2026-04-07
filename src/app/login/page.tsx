"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/useT";

export default function LoginPage() {
  const t = useT();
  const params = useSearchParams();
  const nextPath = useMemo(() => params.get("next") || "/projects", [params]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    }).catch(() => null);

    if (!res || !res.ok) {
      setLoading(false);
      setError(t("auth.invalidCredentials"));
      return;
    }

    // Sanity check: session cookie must be readable server-side; if not, show a clear hint.
    const sessionRes = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "include"
    }).catch(() => null);
    const sessionJson = sessionRes?.ok ? await sessionRes.json().catch(() => null) : null;
    if (!sessionJson?.session) {
      setLoading(false);
      setError(t("auth.sessionMissing"));
      return;
    }

    window.location.assign(nextPath);
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
        <div className="text-sm text-text-muted">{t("auth.title")}</div>
        <h1 className="mt-2 text-xl font-semibold">QA Docs</h1>
        <form className="mt-6 space-y-3" onSubmit={onSubmit} autoComplete="off">
          <div className="space-y-1">
            <label className="text-sm text-text-muted">{t("auth.email")}</label>
            <input
              className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              name="qadocs_email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-text-muted">{t("auth.password")}</label>
            <div className="relative">
              <input
                className="w-full rounded-lg border bg-surface-2 px-3 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                name="qadocs_password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={showPassword ? t("profile.hidePassword") : t("profile.showPassword")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:bg-surface-1"
                onClick={() => setShowPassword((v) => !v)}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <button
            className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium hover:bg-brand-500 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? t("common.signIn") : t("auth.title")}
          </button>
        </form>
      </div>
    </div>
  );
}

