"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { ProjectFormSelect } from "@/components/ProjectSelect";

type Project = { id: string; name: string; slug: string };
type TestCaseLite = { id: string; title: string; status: string };
type ChecklistLite = { id: string; title: string; status: string };
type TestPlanApiResponse = {
  testPlan?: {
    id: string;
    projectId: string;
    title: string;
    objective: string | null;
    scope: string | null;
    status: "draft" | "active" | "archived";
    tags: string[];
    cases: Array<{
      testCaseId: string;
      testCase: {
        id: string;
        title: string;
        status: string;
      };
    }>;
    checklists: Array<{
      checklistId: string;
      checklist: {
        id: string;
        title: string;
        status: string;
      };
    }>;
  };
};

export default function EditTestPlanPage({ params }: { params: { id: string } }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [cases, setCases] = useState<TestCaseLite[]>([]);
  const [checklists, setChecklists] = useState<ChecklistLite[]>([]);

  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [tags, setTags] = useState("");
  const [objective, setObjective] = useState("");
  const [scope, setScope] = useState("");
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

  useEffect(() => {
    fetch("/api/projects", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setProjects((json?.projects ?? []) as Project[]))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setCases([]);
      setChecklists([]);
      return;
    }

    setCases([]);
    setChecklists([]);
    fetch(`/api/test-cases?projectId=${encodeURIComponent(projectId)}`, {
      credentials: "include"
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setCases((json?.testCases ?? []) as TestCaseLite[]))
      .catch(() => setCases([]));

    fetch(`/api/checklists?projectId=${encodeURIComponent(projectId)}`, {
      credentials: "include"
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setChecklists((json?.checklists ?? []) as ChecklistLite[]))
      .catch(() => setChecklists([]));
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetch(`/api/test-plans/${params.id}`, { cache: "no-store", credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((json: TestPlanApiResponse) => {
        if (!alive) return;
        const plan = json?.testPlan;
        if (!plan) {
          setError(t("validation.notFound"));
          return;
        }
        setProjectId(plan.projectId);
        setTitle(plan.title);
        setStatus(plan.status);
        setTags(plan.tags?.join(", ") ?? "");
        setObjective(plan.objective ?? "");
        setScope(plan.scope ?? "");
        setSelected(
          plan.cases.reduce((acc, item) => {
            acc[item.testCaseId] = true;
            return acc;
          }, {} as Record<string, boolean>)
        );
        setSelectedChecklists(
          plan.checklists.reduce((acc, item) => {
            acc[item.checklistId] = true;
            return acc;
          }, {} as Record<string, boolean>)
        );
      })
      .catch((err) => {
        if (!alive) return;
        if (err?.status === 401) {
          window.location.assign(`/login?next=${encodeURIComponent(`/test-plans/${params.id}/edit`)}`);
          return;
        }
        setError(t("testPlans.loadFailed"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [params.id, t]);

  function validate() {
    const errors: Record<string, string> = {};
    if (!projectId.trim()) errors.projectId = t("validation.projectRequired");
    if (!title.trim()) errors.title = t("validation.titleRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validate()) return;

    setSaving(true);
    const res = await fetch(`/api/test-plans/${params.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        objective,
        scope,
        status,
        tags: tags
          .split(",")
          .map((item) => item.trim())
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

    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent(`/test-plans/${params.id}/edit`)}`);
      return;
    }

    const json = (await res.json().catch(() => null)) as { error?: string };
    if (res.status === 403) {
      setSaving(false);
      setError(t("validation.forbidden"));
      return;
    }
    if (!res.ok) {
      setSaving(false);
      setError(json?.error ?? t("testPlans.createFailed"));
      return;
    }

    window.location.assign(`/test-plans/${params.id}`);
  }

  if (loading) {
    return <div className="text-sm text-text-muted">{t("common.loading")}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <div className="text-sm text-text-muted">{t("testPlans.edit")}</div>
        <h1 className="mt-1 text-xl font-semibold">{t("testPlans.edit")}</h1>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
        <form className="space-y-4" onSubmit={onSave}>
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
              firstOptionKey="testPlans.selectProject"
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
              onChange={(e) => {
                setTitle(e.target.value);
                setFieldErrors((prev) => ({ ...prev, title: "" }));
              }}
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
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-muted">{t("testPlans.form.includeTestCases")}</div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">
                  {selectedIds.length} {t("testPlans.form.selected")}
                </span>
                <button
                  type="button"
                  className="rounded-lg border bg-surface-2 px-3 py-1 text-xs font-medium hover:bg-surface-1"
                  onClick={() => setSelected(cases.reduce((acc, item) => ({ ...acc, [item.id]: true }), {} as Record<string, boolean>))}
                >
                  {t("common.selectAll")}
                </button>
                <button
                  type="button"
                  className="rounded-lg border bg-surface-2 px-3 py-1 text-xs font-medium hover:bg-surface-1"
                  onClick={() => setSelected({})}
                >
                  {t("common.clearAll")}
                </button>
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
                  {cases.map((testCase) => (
                    <tr key={testCase.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={!!selected[testCase.id]}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [testCase.id]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="px-4 py-2">{testCase.title}</td>
                      <td className="px-4 py-2 text-text-muted">{t(`testPlans.status.${testCase.status}` as any)}</td>
                    </tr>
                  ))}
                  {projectId && cases.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-text-muted" colSpan={3}>
                        {t("testPlans.form.noCasesInProject")}
                      </td>
                    </tr>
                  ) : null}
                  {!projectId ? (
                    <tr>
                      <td className="px-4 py-6 text-text-muted" colSpan={3}>
                        {t("validation.projectRequired")}.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-muted">{t("testPlans.form.includeChecklists")}</div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-muted">
                  {selectedChecklistIds.length} {t("testPlans.form.selected")}
                </span>
                <button
                  type="button"
                  className="rounded-lg border bg-surface-2 px-3 py-1 text-xs font-medium hover:bg-surface-1"
                  onClick={() => setSelectedChecklists(checklists.reduce((acc, item) => ({ ...acc, [item.id]: true }), {} as Record<string, boolean>))}
                >
                  {t("common.selectAll")}
                </button>
                <button
                  type="button"
                  className="rounded-lg border bg-surface-2 px-3 py-1 text-xs font-medium hover:bg-surface-1"
                  onClick={() => setSelectedChecklists({})}
                >
                  {t("common.clearAll")}
                </button>
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
                          onChange={(e) =>
                            setSelectedChecklists((prev) => ({ ...prev, [checklist.id]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="px-4 py-2">{checklist.title}</td>
                      <td className="px-4 py-2 text-text-muted">{t(`checklists.status.${checklist.status}` as any)}</td>
                    </tr>
                  ))}
                  {projectId && checklists.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-text-muted" colSpan={3}>
                        {t("testPlans.form.noChecklistsInProject")}
                      </td>
                    </tr>
                  ) : null}
                  {!projectId ? (
                    <tr>
                      <td className="px-4 py-6 text-text-muted" colSpan={3}>
                        {t("validation.projectRequired")}.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            aria-busy={saving}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </form>
      </div>
    </div>
  );
}
