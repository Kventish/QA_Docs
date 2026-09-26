"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { ProjectFormSelect } from "@/components/ProjectSelect";

type EditRow =
  | { type: "step"; step: string; expectedResult: string; actualResult: string }
  | { type: "include"; testCaseId: string };
type Project = { id: string; name: string; slug: string };

const emptyStep: { type: "step"; step: string; expectedResult: string; actualResult: string } = {
  type: "step",
  step: "",
  expectedResult: "",
  actualResult: ""
};

function serializeSteps(rows: EditRow[]) {
  return rows.map((r) => {
    if (r.type === "include") return { kind: "include" as const, testCaseId: r.testCaseId };
    return {
      kind: "step" as const,
      step: r.step,
      expectedResult: r.expectedResult,
      actualResult: r.actualResult
    };
  });
}

export default function NewTestCasePage() {
  const t = useT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [caseOptions, setCaseOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [tags, setTags] = useState("");
  const [preconditions, setPreconditions] = useState("");
  const [postconditions, setPostconditions] = useState("");
  const [steps, setSteps] = useState<EditRow[]>([{ ...emptyStep }]);
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
      setCaseOptions([]);
      return;
    }
    let alive = true;
    fetch(`/api/test-cases?projectId=${encodeURIComponent(projectId)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        setCaseOptions((j?.testCases ?? []) as Array<{ id: string; title: string }>);
      })
      .catch(() => setCaseOptions([]));
    return () => {
      alive = false;
    };
  }, [projectId]);

  function updateStepRow(idx: number, patch: Partial<Extract<EditRow, { type: "step" }>>) {
    setSteps((v) =>
      v.map((s, i) => (i === idx && s.type === "step" ? { ...s, ...patch } : s))
    );
  }

  function setRowType(idx: number, newType: "step" | "include") {
    setSteps((v) =>
      v.map((s, i) => {
        if (i !== idx) return s;
        if (newType === "include") return { type: "include", testCaseId: "" };
        return { ...emptyStep };
      })
    );
  }

  function updateInclude(idx: number, testCaseId: string) {
    setSteps((v) => v.map((s, i) => (i === idx && s.type === "include" ? { ...s, testCaseId } : s)));
  }

  function insertStepAfter(afterIndex: number) {
    setSteps((v) => [...v.slice(0, afterIndex + 1), { ...emptyStep }, ...v.slice(afterIndex + 1)]);
  }

  function insertIncludeAfter(afterIndex: number) {
    setSteps((v) => [
      ...v.slice(0, afterIndex + 1),
      { type: "include", testCaseId: "" },
      ...v.slice(afterIndex + 1)
    ]);
  }

  function validate(): boolean {
    const err: Record<string, string> = {};
    if (!projectId.trim()) err.projectId = t("validation.projectRequired");
    if (!title.trim()) err.title = t("validation.titleRequired");
    const hasContent = steps.some(
      (r) =>
        (r.type === "step" && r.step.trim()) || (r.type === "include" && r.testCaseId.trim())
    );
    if (!hasContent) err.steps = t("testCases.form.stepRequired");
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validate()) return;

    setSaving(true);
    const res = await fetch("/api/test-cases", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        status,
        tags: tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        preconditions,
        postconditions,
        steps: serializeSteps(steps)
      })
    }).catch(() => null);

    if (!res) {
      setSaving(false);
      setError(t("testCases.createFailed"));
      return;
    }
    const json = (await res.json().catch(() => null)) as { error?: string; testCase?: { id?: string } };
    if (!res.ok) {
      setSaving(false);
      setError(json?.error ?? t("testCases.createFailed"));
      return;
    }

    window.location.assign(`/test-cases/${json?.testCase?.id ?? ""}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="text-sm text-text-muted">{t("testCases.title")}</div>
        <h1 className="mt-1 text-xl font-semibold">{t("testCases.newTestCase")}</h1>
      </div>

      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm text-text-muted">
              {t("testCases.form.project")} <span className="text-red-400">*</span>
            </label>
            <ProjectFormSelect
              projects={projects}
              value={projectId}
              onChange={(id) => {
                setProjectId(id);
                setFieldErrors((x) => ({ ...x, projectId: "" }));
              }}
              className={`w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.projectId ? "border-red-500" : ""}`}
            />
            {fieldErrors.projectId ? <p className="text-xs text-red-400">{fieldErrors.projectId}</p> : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm text-text-muted">
              {t("testCases.form.title")} <span className="text-red-400">*</span>
            </label>
            <input
              className={`w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.title ? "border-red-500" : ""}`}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setFieldErrors((x) => ({ ...x, title: "" }));
              }}
              placeholder={t("testCases.form.titlePlaceholder")}
            />
            {fieldErrors.title ? <p className="text-xs text-red-400">{fieldErrors.title}</p> : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-text-muted">{t("testCases.form.status")}</label>
              <select
                className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "active" | "archived")}
              >
                <option value="draft">{t("testCases.status.draft")}</option>
                <option value="active">{t("testCases.status.active")}</option>
                <option value="archived">{t("testCases.status.archived")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-text-muted">{t("testCases.form.tagsLabel")}</label>
              <input
                className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t("testCases.form.tagsPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-text-muted">{t("testCases.form.preconditions")}</label>
            <textarea
              className="min-h-[72px] w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={preconditions}
              onChange={(e) => setPreconditions(e.target.value)}
              placeholder={t("testCases.form.preconditionsPlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-text-muted">{t("testCases.form.postconditions")}</label>
            <textarea
              className="min-h-[72px] w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={postconditions}
              onChange={(e) => setPostconditions(e.target.value)}
              placeholder={t("testCases.form.postconditionsPlaceholder")}
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm text-text-muted">
              {t("testCases.form.steps")} <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-text-muted">{t("testCases.form.includeHint")}</p>
            {fieldErrors.steps ? <p className="text-xs text-red-400">{fieldErrors.steps}</p> : null}
            <div className="space-y-4">
              {steps.map((s, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="rounded-lg border border-surface-2 bg-surface-2/50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-text-muted">
                          {t("testCases.form.step", { n: idx + 1 })}
                        </span>
                        <select
                          className="rounded border bg-surface-2 px-2 py-1 text-xs"
                          value={s.type}
                          onChange={(e) => setRowType(idx, e.target.value as "step" | "include")}
                        >
                          <option value="step">{t("testCases.form.rowTypeStep")}</option>
                          <option value="include">{t("testCases.form.rowTypeInclude")}</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        className="rounded border bg-surface-2 px-2 py-1 text-sm hover:bg-surface-1"
                        onClick={() => setSteps((v) => v.filter((_, i) => i !== idx))}
                        disabled={steps.length <= 1}
                      >
                        {t("common.remove")}
                      </button>
                    </div>
                    {s.type === "include" ? (
                      <div className="space-y-1">
                        <label className="text-xs text-text-muted">{t("testCases.form.selectTestCaseToInclude")}</label>
                        <select
                          className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          value={s.testCaseId}
                          onChange={(e) => updateInclude(idx, e.target.value)}
                        >
                          <option value="">{t("testCases.form.selectTestCaseToInclude")}</option>
                          {caseOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs text-text-muted">{t("testCases.form.stepField")}</label>
                          <textarea
                            className="min-h-[80px] w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            value={s.step}
                            onChange={(e) => updateStepRow(idx, { step: e.target.value })}
                            placeholder={t("testCases.form.stepPlaceholder")}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-text-muted">{t("testCases.form.expectedResult")}</label>
                          <textarea
                            className="min-h-[70px] w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            value={s.expectedResult}
                            onChange={(e) => updateStepRow(idx, { expectedResult: e.target.value })}
                            placeholder={t("testCases.form.expectedResultPlaceholder")}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-text-muted">{t("testCases.form.actualResult")}</label>
                          <textarea
                            className="min-h-[70px] w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            value={s.actualResult}
                            onChange={(e) => updateStepRow(idx, { actualResult: e.target.value })}
                            placeholder={t("testCases.form.actualResultPlaceholder")}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
                      onClick={() => insertStepAfter(idx)}
                    >
                      {t("testCases.form.addStep")}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1"
                      onClick={() => insertIncludeAfter(idx)}
                    >
                      {t("testCases.form.addIncludeRow")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">{error}</div>
          ) : null}

          <button
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-500 disabled:opacity-60"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? t("common.creating") : t("common.create")}
          </button>
        </form>
      </div>
    </div>
  );
}
