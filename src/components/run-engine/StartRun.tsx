"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/useT";
import { runLabels, runErrorLabel } from "@/lib/i18n/dictionaries/run-engine";
import { durationText, Kind, documentPaths } from "@/lib/run-engine/domain";

type ActiveRun = { id: string; startedAt: string; startedByEmailSnapshot: string };
const documentKeys = { test_case: "testCases", checklist: "checklists", test_plan: "testPlans" } as const;

export default function StartRun({ kind, id, title, status, executableCount, activeRun, serverNow }: {
  kind: Kind; id: string; title: string; status: string; executableCount?: number;
  activeRun?: ActiveRun | null; serverNow: string;
}) {
  const locale = useLocale();
  const t = useT();
  const r = runLabels[locale];
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const key = useRef<string>();
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => Date.parse(serverNow));
  const base = `/${documentPaths[kind]}/${id}`;

  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeRun]);

  async function start() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    const storageKey = `run-start:${kind}:${id}`;
    try {
      key.current = key.current ?? sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, key.current);
      const response = await fetch(`/api/v2/${documentPaths[kind]}/${id}/runs`, { method: "POST", headers: { "Idempotency-Key": key.current } });
      const body = await response.json();
      if (!response.ok) { setError(body.error ?? "serverError"); return; }
      sessionStorage.removeItem(storageKey);
      window.location.assign(`/runs/${body.runId}`);
    } catch { setError("network"); }
    finally { setBusy(false); busyRef.current = false; }
  }

  const primaryClass = "inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryClass = "inline-flex items-center justify-center rounded-lg border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-1";
  const tertiaryClass = "inline-flex items-center justify-center px-2 py-2 text-sm font-medium text-text-muted hover:text-text-primary";

  return <div className="mx-auto max-w-3xl space-y-6">
    <header className="space-y-2">
      <nav className="text-sm text-text-muted"><Link className="hover:text-text-primary" href={`/${documentPaths[kind]}`}>{t(`${documentKeys[kind]}.title`)}</Link><span className="px-2">/</span><span>{title}</span></nav>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">{r.startPage.titles[kind]}</p>
      <h1 className="text-2xl font-semibold">{title}</h1>
    </header>

    {activeRun && <section className="space-y-4 rounded-xl border border-brand-500/40 bg-surface-1 p-5 shadow-soft">
      <div><h2 className="font-semibold">{r.startPage.activeTitle}</h2><p className="mt-1 text-sm text-text-muted">{r.startPage.activeDescription}</p></div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-text-muted">{r.date}</dt><dd className="mt-1">{new Date(activeRun.startedAt).toLocaleString(locale)}</dd></div>
        <div><dt className="text-text-muted">{r.duration}</dt><dd className="mt-1 font-mono">{durationText(clock - Date.parse(activeRun.startedAt))}</dd></div>
        <div><dt className="text-text-muted">{r.user}</dt><dd className="mt-1 break-all">{activeRun.startedByEmailSnapshot}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-3"><Link className={primaryClass} href={`/runs/${activeRun.id}`}>{r.startPage.continueRun}</Link><button className={secondaryClass} disabled={busy} onClick={start}>{busy ? r.loading : r.startPage.startNew}</button></div>
    </section>}

    <section className="space-y-5 rounded-xl border bg-surface-1 p-6 shadow-soft">
      <div><h2 className="font-semibold">{r.startPage.beforeStart}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{r.startPage.description}</p></div>
      <dl className="grid gap-4 border-y border-border py-4 text-sm sm:grid-cols-3">
        <div><dt className="text-text-muted">{r.startPage.documentStatus}</dt><dd className="mt-1 font-medium">{t(`${documentKeys[kind]}.status.${status}`)}</dd></div>
        {executableCount !== undefined && <div><dt className="text-text-muted">{r.startPage.executableSteps}</dt><dd className="mt-1 font-medium">{executableCount}</dd></div>}
        <div><dt className="text-text-muted">{r.version}</dt><dd className="mt-1 font-medium">{r.snapshot}</dd></div>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        {!activeRun && <button className={primaryClass} disabled={busy} onClick={start}>{busy ? r.loading : r.startPage.startRun}</button>}
        <Link className={secondaryClass} href={`${base}/runs`}>{r.history}</Link><Link className={tertiaryClass} href={base}>{r.back}</Link>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">{runErrorLabel(error, r)}</p>}
    </section>
  </div>;
}
