"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useT } from "@/lib/i18n/useT";

type TestCase = {
  id: string;
  title: string;
  description: string;
  status: "draft" | "active" | "archived";
  tags: string[];
  updatedAt: string;
};
type Project = { id: string; name: string; slug: string };

export default function TestCasesPage() {
  const params = useSearchParams();
  const locale = useLocale();
  const t = useT();
  const q = (params.get("q") ?? "").trim();
  const status = (params.get("status") ?? "").trim();
  const projectParam = params.get("projectId") ?? "";

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(projectParam);
  const [items, setItems] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "editor" | "viewer" | null>(null);

  const canEdit = role === "editor" || role === "admin";

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setRole((j?.session?.role as "admin" | "editor" | "viewer") ?? null))
      .catch(() => setRole(null));
  }, []);

  useEffect(() => {
    fetch("/api/projects", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const list = (j?.projects ?? []) as Project[];
        setProjects(list);
        if (list.length) setProjectId((current) => current || list[0].id);
      })
      .catch(() => setProjects([]));
  }, []);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (status && c.status !== status) return false;
      if (!q) return true;
      const hay = `${c.title}\n${c.description ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [items, q, status]);

  useEffect(() => {
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/test-cases?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => {
        if (!alive) return;
        setItems(j?.testCases ?? []);
      })
      .catch(async (r) => {
        if (!alive) return;
        if (r?.status === 401) {
          window.location.assign(`/login?next=${encodeURIComponent("/test-cases")}`);
          return;
        }
        setError(t("testCases.loadFailed"));
        setItems([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, t]);

  async function deleteCase(id: string) {
    if (!confirm(t("testCases.deleteConfirm"))) return;
    setError(null);
    setDeletingId(id);
    const res = await fetch(`/api/test-cases/${id}`, {
      method: "DELETE",
      credentials: "include"
    }).catch(() => null);

    if (!res) {
      setDeletingId(null);
      setError(t("testCases.deleteFailed"));
      return;
    }
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent("/test-cases")}`);
      return;
    }
    if (res.status === 403) {
      setDeletingId(null);
      setError(t("testCases.forbidden"));
      return;
    }
    if (!res.ok) {
      setDeletingId(null);
      setError(t("testCases.deleteFailed"));
      return;
    }

    setItems((prev) => prev.filter((x) => x.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("testCases.title")}</h1>
        {canEdit && (
          <Link
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium hover:bg-brand-500"
            href="/test-cases/new"
          >
            {t("testCases.newTestCase")}
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <form className="flex flex-1 flex-wrap gap-2" action="/test-cases" method="get">
          <input type="hidden" name="projectId" value={projectId} />
          <input
            name="q"
            defaultValue={q}
            className="w-full min-w-[220px] flex-1 rounded-lg border bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={t("testCases.searchPlaceholder")}
          />
          <select
            name="status"
            defaultValue={status}
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">{t("common.all")}</option>
            <option value="draft">{t("testCases.status.draft")}</option>
            <option value="active">{t("testCases.status.active")}</option>
            <option value="archived">{t("testCases.status.archived")}</option>
          </select>
          <button className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1">
            {t("common.apply")}
          </button>
        </form>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-surface-1">
        <table className="w-full text-sm">
          <thead className="border-b bg-surface-2 text-left text-text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t("common.columns.title")}</th>
              <th className="px-4 py-3 font-medium">{t("common.columns.status")}</th>
              <th className="px-4 py-3 font-medium">{t("common.columns.tags")}</th>
              <th className="px-4 py-3 font-medium">{t("common.columns.updated")}</th>
              {canEdit && <th className="px-4 py-3 font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link className="hover:underline" href={`/test-cases/${c.id}`}>
                    {c.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md border bg-surface-2 px-2 py-0.5 text-xs">
                    {t(`testCases.status.${c.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted">{c.tags?.join(", ")}</td>
                <td className="px-4 py-3 text-text-muted">
                  {new Date(c.updatedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <button
                      className="rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1 disabled:opacity-60"
                      disabled={deletingId === c.id}
                      onClick={() => deleteCase(c.id)}
                      title={t("testCases.delete")}
                    >
                      {deletingId === c.id ? "…" : t("testCases.delete")}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!loading && filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={canEdit ? 5 : 4}>
                  {t("testCases.empty")}
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={canEdit ? 5 : 4}>
                  {t("common.loading")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

