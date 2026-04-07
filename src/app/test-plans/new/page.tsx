"use client";

import { useEffect, useMemo, useState } from "react";
import { useT, useLocale } from "@/lib/i18n/useT";
import { ProjectFormSelect } from "@/components/ProjectSelect";

type TestCaseLite = { id: string; title: string; status: string; tags: string[] };
type ChecklistLite = { id: string; title: string; status: string };
type Project = { id: string; name: string; slug: string };

export default function NewTestPlanPage() {
  const locale = useLocale();
  const t = useT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [scope, setScope] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [tags, setTags] = useState("");
  const [cases, setCases] = useState<TestCaseLite[]>([]);
  const [checklists, setChecklists] = useState<ChecklistLite[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectedChecklists, setSelectedChecklists] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(
    () => cases.filter((item) => selected[item.id]).map((item) => item.id),
    [cases, selected]
  );
  const selectedChecklistIds = useMemo(
    () => checklists.filter((item) => selectedChecklists[item.id]).map((item) => item.id),
    [checklists, selectedChecklists]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (!projectId) {
      setCases([]);
      setChecklists([]);
      return;
    }
    fetch(`/api/test-cases?projectId=${encodeURIComponent(projectId)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCases(j?.testCases ?? []))
      .catch(() => setCases([]));
    fetch(`/api/checklists?projectId=${encodeURIComponent(projectId)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setChecklists(j?.checklists ?? []))
      .catch(() => setChecklists([]));
  }, [projectId]);

  function validate(): boolean {
    const err: Record<string, string> = {};
    if (!projectId.trim()) err.projectId = t("validation.projectRequired");
    if (!title.trim()) err.title = t("validation.titleRequired");
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validate()) return;

    setSaving(true);
    const res = await fetch("/api/test-plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        objective,
        scope,
        status,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        testCaseIds: selectedIds,
        checklistIds: selectedChecklistIds
      })
    }).catch(() => null);

    if (!res) {
      setSaving(false);
      setError(t("testPlans.createFailed"));
      return;
    }
    const json = (await res.json().catch(() => null)) as { error?: string; testPlan?: { id?: string } };
    if (!res.ok) {
      setSaving(false);
      setError(json?.error ?? t("testPlans.createFailed"));
      return;
    }

    window.location.assign(`/test-plans/${json?.testPlan?.id ?? ""}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <div className="text-sm text-text-muted">{t("testPlans.title")}</div>
        <h1 className="mt-1 text-xl font-semibold">{t("testPlans.newTestPlan")}</h1>
      </div>

      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm text-text-muted">
              {t("testPlans.form.project")} <span className="text-red-400">*</span>
            </label>
            <ProjectFormSelect
              projects={projects}
              value={projectId}
              onChange={(id) => {
                setProjectId(id);
                setSelected({});
                setSelectedChecklists({});
                setFieldErrors((prev) => ({ ...prev, projectId: "" }));
              }}
              className={`w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.projectId ? "border-red-500" : ""}`}
            />
            {fieldErrors.projectId ? (
              <p className="text-xs text-red-400">{fieldErrors.projectId}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm text-text-muted">
              {t("testPlans.form.title")} <span className="text-red-400">*</span>
            </label>
            <input
              className={`w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.title ? "border-red-500" : ""}`}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setFieldErrors((e) => ({ ...e, title: "" })); }}
              placeholder={t("testPlans.form.titlePlaceholder")}
            />
            {fieldErrors.title ? (
              <p className="text-xs text-red-400">{fieldErrors.title}</p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-text-muted">{t("testPlans.form.status")}</label>
              <select
                className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "active" | "archived")}
              >
                <option value="draft">{t("testPlans.status.draft")}</option>
                <option value="active">{t("testPlans.status.active")}</option>
                <option value="archived">{t("testPlans.status.archived")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-text-muted">{t("testPlans.form.tagsLabel")}</label>
              <input
                className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t("testPlans.form.tagsPlaceholder")}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-text-muted">{t("testPlans.form.objective")}</label>
              <textarea
                className="min-h-[90px] w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-text-muted">{t("testPlans.form.scope")}</label>
              <textarea
                className="min-h-[90px] w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-text-muted">{t("testPlans.form.includeTestCases")}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-muted">
                  {selectedIds.length} {t("testPlans.form.selected")}
                </span>
                <div className="inline-flex overflow-hidden rounded-lg border bg-surface-2">
                  <button
                    type="button"
                    className="px-3 py-1 text-xs font-medium hover:bg-surface-1"
                    onClick={() => setSelected(cases.reduce((acc, item) => ({ ...acc, [item.id]: true }), {} as Record<string, boolean>))}
                  >
                    {t("common.selectAll")}
                  </button>
                  <div className="w-px bg-border" />
                  <button
                    type="button"
                    className="px-3 py-1 text-xs font-medium hover:bg-surface-1"
                    onClick={() => setSelected({})}
                  >
                    {t("common.clearAll")}
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-[320px] overflow-auto rounded-xl border bg-surface-2">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-surface-2 text-left text-text-muted">
                  <tr>
                    <th className="w-10 px-4 py-2 font-medium"></th>
                    <th className="px-4 py-2 font-medium">{t("common.columns.title")}</th>
                    <th className="px-4 py-2 font-medium">{t("common.columns.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={!!selected[c.id]}
                          onChange={(e) => setSelected((s) => ({ ...s, [c.id]: e.target.checked }))}
                        />
                      </td>
                      <td className="px-4 py-2">{c.title}</td>
                      <td className="px-4 py-2 text-text-muted">{c.status}</td>
                    </tr>
                  ))}
                  {!projectId ? (
                    <tr>
                      <td className="px-4 py-6 text-text-muted" colSpan={3}>
                        {t("validation.projectRequired")}.
                      </td>
                    </tr>
                  ) : cases.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-text-muted" colSpan={3}>
                        {t("testPlans.form.noCasesInProject")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-text-muted">{t("testPlans.form.includeChecklists")}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-muted">
                  {selectedChecklistIds.length} {t("testPlans.form.selected")}
                </span>
                <div className="inline-flex overflow-hidden rounded-lg border bg-surface-2">
                  <button
                    type="button"
                    className="px-3 py-1 text-xs font-medium hover:bg-surface-1"
                    onClick={() => setSelectedChecklists(checklists.reduce((acc, item) => ({ ...acc, [item.id]: true }), {} as Record<string, boolean>))}
                  >
                    {t("common.selectAll")}
                  </button>
                  <div className="w-px bg-border" />
                  <button
                    type="button"
                    className="px-3 py-1 text-xs font-medium hover:bg-surface-1"
                    onClick={() => setSelectedChecklists({})}
                  >
                    {t("common.clearAll")}
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-[320px] overflow-auto rounded-xl border bg-surface-2">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-surface-2 text-left text-text-muted">
                  <tr>
                    <th className="w-10 px-4 py-2 font-medium"></th>
                    <th className="px-4 py-2 font-medium">{t("common.columns.title")}</th>
                    <th className="px-4 py-2 font-medium">{t("common.columns.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {checklists.map((checklist) => (
                    <tr key={checklist.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={!!selectedChecklists[checklist.id]}
                          onChange={(e) => setSelectedChecklists((s) => ({ ...s, [checklist.id]: e.target.checked }))}
                        />
                      </td>
                      <td className="px-4 py-2">{checklist.title}</td>
                      <td className="px-4 py-2 text-text-muted">{checklist.status}</td>
                    </tr>
                  ))}
                  {!projectId ? (
                    <tr>
                      <td className="px-4 py-6 text-text-muted" colSpan={3}>
                        {t("validation.projectRequired")}.
                      </td>
                    </tr>
                  ) : checklists.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-text-muted" colSpan={3}>
                        {t("testPlans.form.noChecklistsInProject")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <button
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-500 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? t("common.loading") : t("common.create")}
          </button>
        </form>
      </div>
    </div>
  );
}
