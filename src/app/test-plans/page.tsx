"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/useT";
import { ProjectFilterSelect } from "@/components/ProjectSelect";

type TestPlan = {
  id: string;
  title: string;
  status: string;
  tags: string[];
  updatedAt: string;
};
type Project = { id: string; name: string; slug: string };

export default function TestPlansPage() {
  const locale = useLocale();
  const t = useT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [items, setItems] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  async function refresh() {
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);
    const res = await fetch(`/api/test-plans?projectId=${encodeURIComponent(projectId)}`, {
      credentials: "include"
    }).catch(() => null);
    if (!res) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent("/test-plans")}`);
      return;
    }
    const json = await res.json().catch(() => null);
    setItems(json?.testPlans ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [projectId, t]);

  async function deleteTestPlan(id: string) {
    if (!confirm(t("testPlans.deleteConfirm"))) return;
    setError(null);
    setDeletingId(id);

    const res = await fetch(`/api/test-plans/${id}`, {
      method: "DELETE",
      credentials: "include"
    }).catch(() => null);

    if (!res) {
      setDeletingId(null);
      setError(t("testPlans.loadFailed"));
      return;
    }
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent("/test-plans")}`);
      return;
    }
    if (res.status === 403) {
      setDeletingId(null);
      setError(t("validation.forbidden"));
      return;
    }
    if (!res.ok) {
      setDeletingId(null);
      setError(t("testPlans.loadFailed"));
      return;
    }

    setDeletingId(null);
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold">{t("testPlans.title")}</h1>
        <div className="flex items-center gap-2">
          <ProjectFilterSelect
            projects={projects}
            value={projectId}
            onChange={setProjectId}
            className="rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {canEdit && (
            <Link
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium hover:bg-brand-500"
              href="/test-plans/new"
            >
              {t("testPlans.newTestPlan")}
            </Link>
          )}
        </div>
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
            {items.map((p) => (
              <tr key={p.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">
                  <Link className="hover:underline" href={`/test-plans/${p.id}`}>
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md border bg-surface-2 px-2 py-0.5 text-xs">
                    {t(`testPlans.status.${p.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted">{p.tags?.join(", ") ?? ""}</td>
                <td className="px-4 py-3 text-text-muted">
                  {new Date(p.updatedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <button
                      className="rounded-lg border bg-surface-2 px-2 py-1 text-xs font-medium hover:bg-surface-1 disabled:opacity-60"
                      disabled={deletingId === p.id}
                      onClick={() => deleteTestPlan(p.id)}
                      title={t("testPlans.delete")}
                    >
                      {deletingId === p.id ? "…" : t("testPlans.delete")}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!loading && projects.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={canEdit ? 5 : 4}>
                  {t("common.noProjectsTableHint")}
                </td>
              </tr>
            ) : null}
            {!loading && projects.length > 0 && items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={canEdit ? 5 : 4}>
                  {t("testPlans.empty")}
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
