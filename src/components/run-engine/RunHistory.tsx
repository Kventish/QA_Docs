import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { runLabels } from "@/lib/i18n/dictionaries/run-engine";
import { Kind, documentPaths, durationText, RunError } from "@/lib/run-engine/domain";
import { runHistory } from "@/lib/run-engine/history";

function badge(status: string | null) {
  if (status === "passed" || status === "completed") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
  if (status === "failed" || status === "cancelled") return "border-red-500/40 bg-red-500/10 text-red-400";
  if (status === "questionable") return "border-amber-500/40 bg-amber-500/10 text-amber-400";
  return "border-border bg-surface-2 text-text-muted";
}

const cellLink = "block px-4 py-3 text-sm";

export default async function RunHistory({ kind, id, page: inputPage }: { kind: Kind; id: string; page?: string }) {
  const base = `/${documentPaths[kind]}/${id}`;
  const session = await requireRoleOrRedirect("viewer", `${base}/runs`);
  const locale = getServerLocale();
  const r = runLabels[locale];
  const parsedPage = Number(inputPage ?? 1);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 100000 ? parsedPage : 1;
  const history = await runHistory(kind, id, session, page).catch(error => {
    if (error instanceof RunError && error.status === 404) notFound();
    throw error;
  });
  const headers = [r.date, r.user, r.result, r.lifecycle, r.duration, r.version];
  const primaryClass = "inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500";
  const secondaryClass = "inline-flex items-center justify-center rounded-lg border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-1";

  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">{r.history}</p><h1 className="text-2xl font-semibold">{history.document.title}</h1></div>
      <nav className="flex flex-wrap gap-3"><Link className={secondaryClass} href={base}>{r.back}</Link>{session.role !== "viewer" && <Link className={primaryClass} href={`${base}/run`}>{r.startPage.startRun}</Link>}</nav>
    </header>

    <section className="overflow-hidden rounded-xl border bg-surface-1 shadow-soft">
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left">
        <thead className="border-b bg-surface-2 text-xs uppercase tracking-wide text-text-muted"><tr>{headers.map(header => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{history.runs.map(run => {
          const href = `/runs/${run.id}`;
          return <tr key={run.id} className="transition-colors hover:bg-surface-2/60">
            <td><Link className={cellLink} href={href}>{run.startedAt.toLocaleString(locale)}</Link></td>
            <td><Link className={`${cellLink} break-all`} href={href}>{run.startedByEmailSnapshot}</Link></td>
            <td><Link className={cellLink} href={href}><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${badge(run.finalStatus)}`}>{run.finalStatus ? r.states[run.finalStatus] : "—"}</span></Link></td>
            <td><Link className={cellLink} href={href}><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${badge(run.lifecycle)}`}>{r.states[run.lifecycle]}</span></Link></td>
            <td><Link className={`${cellLink} font-mono`} href={href}>{durationText(run.durationMs ?? Date.now() - run.startedAt.getTime())}</Link></td>
            <td><Link className={cellLink} href={href}>{r.snapshot}</Link></td>
          </tr>;
        })}</tbody>
      </table></div>
      {!history.runs.length && <p className="p-8 text-center text-sm text-text-muted">{r.empty}</p>}
    </section>

    {history.pages > 1 && <nav className="flex items-center justify-center gap-4 text-sm">
      {page > 1 ? <Link className={secondaryClass} href={`${base}/runs?page=${page - 1}`}>{r.previousPage}</Link> : <span />}
      <span className="text-text-muted">{page} / {history.pages}</span>
      {page < history.pages ? <Link className={secondaryClass} href={`${base}/runs?page=${page + 1}`}>{r.next}</Link> : <span />}
    </nav>}

    {history.legacy.length > 0 && <section className="space-y-3">
      <div className="flex items-center gap-3"><h2 className="font-semibold">{r.legacyHistory}</h2><span className="rounded-full border bg-surface-2 px-2 py-1 text-xs text-text-muted">{r.legacy}</span></div>
      <div className="overflow-hidden rounded-xl border bg-surface-1 shadow-soft"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left">
        <thead className="border-b bg-surface-2 text-xs uppercase tracking-wide text-text-muted"><tr>{headers.map(header => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{history.legacy.map(run => {
          const href = `${base}/runs/${run.id}`;
          const status = run.status === "passed" || run.status === "failed" ? run.status : null;
          return <tr key={run.id} className="transition-colors hover:bg-surface-2/60">
            <td><Link className={cellLink} href={href}>{run.createdAt.toLocaleString(locale)}</Link></td>
            <td><Link className={cellLink} href={href}>{r.unknown}</Link></td>
            <td><Link className={cellLink} href={href}><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${badge(status)}`}>{status ? r.states[status] : run.status}</span></Link></td>
            <td><Link className={cellLink} href={href}><span className="inline-flex rounded-full border bg-surface-2 px-2 py-1 text-xs text-text-muted">{r.legacy}</span></Link></td>
            <td><Link className={cellLink} href={href}>{r.unknown}</Link></td><td><Link className={cellLink} href={href}>{r.unknown}</Link></td>
          </tr>;
        })}</tbody>
      </table></div></div>
    </section>}
  </div>;
}
