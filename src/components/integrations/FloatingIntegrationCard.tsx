"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/useT";
import { showToast } from "@/components/toast/ToastCenter";

type Context =
  | null
  | {
      kind: "testCase" | "checklist" | "testPlan" | "testCaseRun" | "checklistRun" | "testPlanRun";
      id: string;
      title: string;
      canEdit: boolean;
      jira: { configured: boolean; issueKey: string | null; browseUrl: string | null };
      links: { entityUrl: string; runsUrl: string };
      linked?: {
        testCases: Array<{ id: string; title: string }>;
        checklists: Array<{ id: string; title: string }>;
      };
      run?: any;
    };

function isSupportedPath(pathname: string | null) {
  if (!pathname) return false;
  return (
    /^\/test-cases\/[^/]+\/?$/.test(pathname) ||
    /^\/checklists\/[^/]+\/?$/.test(pathname) ||
    /^\/test-plans\/[^/]+\/?$/.test(pathname) ||
    /^\/test-cases\/[^/]+\/runs\/[^/]+\/?$/.test(pathname) ||
    /^\/checklists\/[^/]+\/runs\/[^/]+\/?$/.test(pathname) ||
    /^\/test-plans\/[^/]+\/runs\/[^/]+\/?$/.test(pathname)
  );
}

export default function FloatingIntegrationCard() {
  const pathname = usePathname();
  const t = useT();
  const [ctx, setCtx] = useState<Context>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"jira" | "linked">("jira");
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem("qa_docs_integration_card_open");
      if (v === "0") setOpen(false);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("qa_docs_integration_card_open", open ? "1" : "0");
    } catch {
      // ignore
    }
  }, [open]);

  useEffect(() => {
    if (!isSupportedPath(pathname)) {
      setCtx(null);
      return;
    }
    setLoading(true);
    fetch(`/api/integrations/context?path=${encodeURIComponent(pathname ?? "")}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => setCtx(json?.context ?? null))
      .catch(() => setCtx(null))
      .finally(() => setLoading(false));
  }, [pathname]);

  const linked = ctx && "linked" in ctx ? ctx.linked : undefined;
  const linkedCases = useMemo(() => linked?.testCases ?? [], [linked?.testCases]);
  const linkedChecklists = useMemo(() => linked?.checklists ?? [], [linked?.checklists]);

  const filteredCases = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return linkedCases;
    return linkedCases.filter((x) => (x.title || "").toLowerCase().includes(q));
  }, [filter, linkedCases]);

  const filteredChecklists = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return linkedChecklists;
    return linkedChecklists.filter((x) => (x.title || "").toLowerCase().includes(q));
  }, [filter, linkedChecklists]);

  async function createJira() {
    if (!ctx) return;
    if (!ctx.canEdit) return;
    if (!ctx.jira.configured) {
      showToast({ type: "error", message: t("jira.notConfigured") });
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const isRun = ctx.kind.endsWith("Run");
      const res = await fetch(isRun ? "/api/jira/run-issues" : "/api/jira/issues", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isRun ? { entity: ctx.kind, runId: ctx.id } : { entity: ctx.kind, id: ctx.id })
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`);
        return;
      }
      if (!res.ok) {
        showToast({ type: "error", message: json?.error ?? t("jira.createFailed") });
        return;
      }
      // refresh context
      const refreshed = await fetch(`/api/integrations/context?path=${encodeURIComponent(pathname ?? "")}`, {
        credentials: "include"
      })
        .then((r) => r.json())
        .catch(() => null);
      setCtx(refreshed?.context ?? ctx);
    } catch {
      showToast({ type: "error", message: t("jira.createFailed") });
    } finally {
      setCreating(false);
    }
  }

  if (!isSupportedPath(pathname)) return null;

  const title = ctx?.title || (loading ? t("common.loading") : "—");
  const issueKey = ctx?.jira.issueKey ?? null;
  const browseUrl = ctx?.jira.browseUrl ?? null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)]">
      <div className="overflow-hidden rounded-2xl border bg-surface-1 shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b bg-surface-2/40 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Integrations</div>
            <div className="truncate text-sm font-semibold">{title}</div>
          </div>
          <button
            type="button"
            className="rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "—" : "+"}
          </button>
        </div>

        {open ? (
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={[
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                  tab === "jira" ? "bg-surface-2" : "bg-surface-1 hover:bg-surface-2"
                ].join(" ")}
                onClick={() => setTab("jira")}
              >
                Jira
              </button>
              {ctx?.kind === "testPlan" ? (
                <button
                  type="button"
                  className={[
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                    tab === "linked" ? "bg-surface-2" : "bg-surface-1 hover:bg-surface-2"
                  ].join(" ")}
                  onClick={() => setTab("linked")}
                >
                  Linked
                </button>
              ) : null}
              <div className="ml-auto flex items-center gap-2">
                {ctx?.links?.runsUrl ? (
                  <Link className="text-xs text-brand-600 hover:underline" href={ctx.links.runsUrl}>
                    {t("common.viewRuns")}
                  </Link>
                ) : null}
                {ctx?.links?.entityUrl ? (
                  <Link className="text-xs text-brand-600 hover:underline" href={ctx.links.entityUrl}>
                    {t("common.back")}
                  </Link>
                ) : null}
              </div>
            </div>

            {tab === "jira" ? (
              <div className="rounded-xl border bg-surface-2/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-text-muted">{issueKey ? t("jira.linkedIssue") : t("jira.noIssueYet")}</div>
                  {issueKey ? (
                    <span className="rounded-md bg-surface-1 px-2 py-0.5 font-mono text-[11px]">{issueKey}</span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {issueKey && browseUrl ? (
                    <a
                      className="rounded-lg border bg-surface-2 px-3 py-2 text-xs font-medium hover:bg-surface-1"
                      href={browseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("jira.openInJira")}
                    </a>
                  ) : null}
                  {!issueKey && ctx?.canEdit ? (
                    <button
                      type="button"
                      className="rounded-lg border bg-surface-2 px-3 py-2 text-xs font-medium hover:bg-surface-1 disabled:opacity-60"
                      disabled={creating}
                      onClick={createJira}
                    >
                      {creating ? t("common.loading") : t("jira.createInJira")}
                    </button>
                  ) : null}
                  {!issueKey && !ctx?.canEdit ? <span className="text-xs text-text-muted">—</span> : null}
                </div>

                {ctx?.kind?.endsWith("Run") && ctx?.run ? (
                  <div className="mt-2 rounded-lg border bg-surface-1 p-2 text-xs text-text-muted space-y-1">
                    <div>
                      <span className="font-medium text-text">{t("common.columns.status")}</span>: {String(ctx.run.status)}
                    </div>
                    {"progress" in ctx.run ? (
                      <div>
                        <span className="font-medium text-text">Progress</span>:{" "}
                        {ctx.kind === "testPlanRun"
                          ? `${ctx.run.progress?.cases?.done ?? 0}/${ctx.run.progress?.cases?.total ?? 0} • ${ctx.run.progress?.checklists?.done ?? 0}/${ctx.run.progress?.checklists?.total ?? 0}`
                          : `${ctx.run.progress?.done ?? 0}/${ctx.run.progress?.total ?? 0}`}
                      </div>
                    ) : null}
                    {ctx.run.firstFailStep ? (
                      <div>
                        <span className="font-medium text-text">First fail</span>: {ctx.run.firstFailStep}
                      </div>
                    ) : null}
                    {ctx.run.attachmentsCount ? (
                      <div>
                        <span className="font-medium text-text">{t("runHistory.attachments")}</span>: {ctx.run.attachmentsCount}
                      </div>
                    ) : null}
                    {ctx.kind === "testPlanRun" && ctx.run.failed ? (
                      <div className="pt-1">
                        <div className="font-medium text-text">Failed</div>
                        <div>{(ctx.run.failed.testCases ?? []).length} test cases</div>
                        <div>{(ctx.run.failed.checklists ?? []).length} checklists</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border bg-surface-2/30 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-text-muted">
                    {linkedCases.length} test cases · {linkedChecklists.length} checklists
                  </div>
                </div>
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full rounded-lg border bg-surface-1 px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder={t("common.search")}
                />

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Test cases</div>
                  <ul className="max-h-40 overflow-auto space-y-1">
                    {filteredCases.slice(0, 50).map((x) => (
                      <li key={x.id}>
                        <Link className="text-xs text-brand-600 hover:underline" href={`/test-cases/${x.id}`}>
                          {x.title || x.id}
                        </Link>
                      </li>
                    ))}
                    {filteredCases.length === 0 ? <li className="text-xs text-text-muted">—</li> : null}
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Checklists</div>
                  <ul className="max-h-40 overflow-auto space-y-1">
                    {filteredChecklists.slice(0, 50).map((x) => (
                      <li key={x.id}>
                        <Link className="text-xs text-brand-600 hover:underline" href={`/checklists/${x.id}`}>
                          {x.title || x.id}
                        </Link>
                      </li>
                    ))}
                    {filteredChecklists.length === 0 ? <li className="text-xs text-text-muted">—</li> : null}
                  </ul>
                </div>
              </div>
            )}

            {!ctx && !loading ? (
              <div className="text-xs text-text-muted">—</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

