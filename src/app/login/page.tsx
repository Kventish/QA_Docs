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
            <input
              className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              name="qadocs_password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
            />
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

