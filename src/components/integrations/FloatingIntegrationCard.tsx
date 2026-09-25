"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/useT";

type Context =
  | null
  | {
      kind: "testCase" | "checklist" | "testPlan" | "testCaseRun" | "checklistRun" | "testPlanRun";
      id: string;
      title: string;
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
  const [filter, setFilter] = useState("");

  useEffect(() => {
    try {
      if (window.localStorage.getItem("qa_docs_integration_card_open") === "0") setOpen(false);
    } catch {
      // ignore unavailable storage
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("qa_docs_integration_card_open", open ? "1" : "0");
    } catch {
      // ignore unavailable storage
    }
  }, [open]);

  useEffect(() => {
    if (!isSupportedPath(pathname)) {
      setCtx(null);
      return;
    }
    setLoading(true);
    fetch(`/api/integrations/context?path=${encodeURIComponent(pathname ?? "")}`, { credentials: "include" })
      .then((response) => response.json())
      .then((json) => setCtx(json?.context ?? null))
      .catch(() => setCtx(null))
      .finally(() => setLoading(false));
  }, [pathname]);

  const linkedCases = useMemo(() => ctx?.linked?.testCases ?? [], [ctx?.linked?.testCases]);
  const linkedChecklists = useMemo(() => ctx?.linked?.checklists ?? [], [ctx?.linked?.checklists]);
  const query = filter.trim().toLowerCase();
  const filteredCases = useMemo(
    () => (query ? linkedCases.filter((item) => item.title.toLowerCase().includes(query)) : linkedCases),
    [linkedCases, query]
  );
  const filteredChecklists = useMemo(
    () => (query ? linkedChecklists.filter((item) => item.title.toLowerCase().includes(query)) : linkedChecklists),
    [linkedChecklists, query]
  );

  if (!isSupportedPath(pathname)) return null;

  const title = ctx?.title || (loading ? t("common.loading") : "—");
  const isRun = ctx?.kind.endsWith("Run") ?? false;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)]">
      <div className="overflow-hidden rounded-2xl border bg-surface-1 shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b bg-surface-2/40 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Details</div>
            <div className="truncate text-sm font-semibold">{title}</div>
          </div>
          <button
            type="button"
            className="rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "—" : "+"}
          </button>
        </div>

        {open ? (
          <div className="space-y-3 px-4 py-3">
            <div className="flex justify-end gap-2">
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

            {isRun && ctx?.run ? (
              <div className="space-y-1 rounded-xl border bg-surface-2/30 p-3 text-xs text-text-muted">
                <div>
                  <span className="font-medium text-text">{t("common.columns.status")}</span>: {String(ctx.run.status)}
                </div>
                {"progress" in ctx.run ? (
                  <div>
                    <span className="font-medium text-text">Progress</span>: {ctx.kind === "testPlanRun"
                      ? `${ctx.run.progress?.cases?.done ?? 0}/${ctx.run.progress?.cases?.total ?? 0} • ${ctx.run.progress?.checklists?.done ?? 0}/${ctx.run.progress?.checklists?.total ?? 0}`
                      : `${ctx.run.progress?.done ?? 0}/${ctx.run.progress?.total ?? 0}`}
                  </div>
                ) : null}
                {ctx.run.firstFailStep ? (
                  <div><span className="font-medium text-text">First fail</span>: {ctx.run.firstFailStep}</div>
                ) : null}
                {ctx.run.attachmentsCount ? (
                  <div><span className="font-medium text-text">{t("runHistory.attachments")}</span>: {ctx.run.attachmentsCount}</div>
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

            {ctx?.kind === "testPlan" ? (
              <div className="space-y-3 rounded-xl border bg-surface-2/30 p-3">
                <div className="text-xs text-text-muted">
                  {linkedCases.length} test cases · {linkedChecklists.length} checklists
                </div>
                <input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="w-full rounded-lg border bg-surface-1 px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder={t("common.search")}
                />
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Test cases</div>
                  <ul className="max-h-40 space-y-1 overflow-auto">
                    {filteredCases.slice(0, 50).map((item) => (
                      <li key={item.id}>
                        <Link className="text-xs text-brand-600 hover:underline" href={`/test-cases/${item.id}`}>
                          {item.title || item.id}
                        </Link>
                      </li>
                    ))}
                    {filteredCases.length === 0 ? <li className="text-xs text-text-muted">—</li> : null}
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Checklists</div>
                  <ul className="max-h-40 space-y-1 overflow-auto">
                    {filteredChecklists.slice(0, 50).map((item) => (
                      <li key={item.id}>
                        <Link className="text-xs text-brand-600 hover:underline" href={`/checklists/${item.id}`}>
                          {item.title || item.id}
                        </Link>
                      </li>
                    ))}
                    {filteredChecklists.length === 0 ? <li className="text-xs text-text-muted">—</li> : null}
                  </ul>
                </div>
              </div>
            ) : null}

            {!ctx && !loading ? <div className="text-xs text-text-muted">—</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
