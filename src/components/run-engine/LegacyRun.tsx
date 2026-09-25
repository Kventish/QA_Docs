import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRoleOrRedirect } from "@/lib/rbac-server";
import { canAccessProject } from "@/lib/project-access";
import { getServerLocale } from "@/lib/i18n/getServerLocale";
import { runLabels } from "@/lib/i18n/dictionaries/run-engine";
import { legacyAttachments } from "@/lib/run-engine/legacy";

export default async function LegacyRun({ id, runId }: { id: string; runId: string }) {
  const session = await requireRoleOrRedirect("viewer", `/test-cases/${id}/runs/${runId}`);
  const current = await prisma.run.findFirst({ where: { id: runId, testCaseId: id } });
  if (current) redirect(`/runs/${runId}`);
  const run = await prisma.testCaseRun.findUnique({ where: { id: runId }, include: { testCase: { select: { projectId: true, title: true } } } });
  if (!run || run.testCaseId !== id || !await canAccessProject(session, run.testCase.projectId)) notFound();
  const locale = getServerLocale();
  const r = runLabels[locale];
  const attachments = legacyAttachments(run.attachmentsJson, run.id);
  const status = run.status === "passed" || run.status === "failed" ? run.status : null;
  const secondaryClass = "inline-flex items-center justify-center rounded-lg border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-1";
  const statusClass = status === "passed" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : status === "failed" ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-border bg-surface-2 text-text-muted";

  return <div className="mx-auto max-w-3xl space-y-6">
    <header className="space-y-3">
      <nav className="text-sm text-text-muted"><Link className="hover:text-text-primary" href={`/test-cases/${id}`}>{run.testCase.title}</Link><span className="px-2">/</span><Link className="hover:text-text-primary" href={`/test-cases/${id}/runs`}>{r.history}</Link></nav>
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold">{run.testCase.title}</h1><span className="rounded-full border bg-surface-2 px-2 py-1 text-xs font-medium text-text-muted">{r.legacy}</span>{status && <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass}`}>{r.states[status]}</span>}</div>
      <Link className={secondaryClass} href={`/test-cases/${id}/runs`}>{r.history}</Link>
    </header>

    <section className="rounded-xl border bg-surface-1 p-6 shadow-soft">
      <h2 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{r.runDetails}</h2>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-text-muted">{r.date}</dt><dd className="mt-1">{run.createdAt.toLocaleString(locale)}</dd></div>
        <div><dt className="text-text-muted">{r.result}</dt><dd className="mt-1">{status ? r.states[status] : run.status}</dd></div>
        <div><dt className="text-text-muted">{r.user}</dt><dd className="mt-1">{r.unknown}</dd></div>
        <div><dt className="text-text-muted">{r.duration}</dt><dd className="mt-1">{r.unknown}</dd></div>
        <div><dt className="text-text-muted">{r.version}</dt><dd className="mt-1">{r.unknown}</dd></div>
      </dl>
      <p className="mt-5 rounded-lg border bg-surface-2 p-4 text-sm text-text-muted">{r.legacyDefinition}</p>
    </section>

    {(run.actualResult || run.notes) && <section className="space-y-4 rounded-xl border bg-surface-1 p-6 shadow-soft">
      {run.actualResult && <div><h2 className="text-sm font-semibold">{r.actual}</h2><p className="mt-2 whitespace-pre-wrap text-sm">{run.actualResult}</p></div>}
      {run.notes && <div><h2 className="text-sm font-semibold">{r.notes}</h2><p className="mt-2 whitespace-pre-wrap text-sm">{run.notes}</p></div>}
    </section>}

    <section className="space-y-3 rounded-xl border bg-surface-1 p-6 shadow-soft">
      <h2 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{r.attachments}</h2>
      {attachments.length ? attachments.map(file => <div key={file.url}><a className="break-all text-sm text-brand-500 underline" href={file.url}>{r.download}: {file.name}</a></div>) : <p className="text-sm text-text-muted">{r.noAttachments}</p>}
    </section>
  </div>;
}
