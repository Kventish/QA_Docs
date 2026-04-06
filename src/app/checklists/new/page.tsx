"use client";

import { useEffect, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/useT";

type Item = { text: string; checked: boolean; expectedResult: string };
type Project = { id: string; name: string; slug: string };

export default function NewChecklistPage() {
  const locale = useLocale();
  const t = useT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [tags, setTags] = useState("");
  const [items, setItems] = useState<Item[]>([{ text: t("checklists.form.defaultItemText"), checked: false, expectedResult: "" }]);
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

  function validate(): boolean {
    const err: Record<string, string> = {};
    if (!projectId.trim()) err.projectId = t("validation.projectRequired");
    if (!title.trim()) err.title = t("validation.titleRequired");
    const hasItem = items.some((it) => it.text.trim());
    if (!hasItem) err.items = t("checklists.form.itemRequired");
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validate()) return;

    setSaving(true);
    const res = await fetch("/api/checklists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        status,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        items
      })
    }).catch(() => null);

    if (!res) {
      setSaving(false);
      setError(t("checklists.createFailed"));
      return;
    }
    const json = (await res.json().catch(() => null)) as { error?: string; checklist?: { id?: string } };
    if (!res.ok) {
      setSaving(false);
      setError(json?.error ?? t("checklists.createFailed"));
      return;
    }

    window.location.assign(`/checklists/${json?.checklist?.id ?? ""}`);
  }

  function insertItemAfter(afterIndex: number) {
    setItems((v) => [
      ...v.slice(0, afterIndex + 1),
      { text: "", checked: false, expectedResult: "" },
      ...v.slice(afterIndex + 1)
    ]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="text-sm text-text-muted">{t("checklists.title")}</div>
        <h1 className="mt-1 text-xl font-semibold">{t("checklists.newChecklist")}</h1>
      </div>

      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm text-text-muted">
              {t("checklists.form.project")} <span className="text-red-400">*</span>
            </label>
            <select
              className={`w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.projectId ? "border-red-500" : ""}`}
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); setFieldErrors((e) => ({ ...e, projectId: "" })); }}
            >
              <option value="">{t("validation.projectRequired")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {fieldErrors.projectId ? (
              <p className="text-xs text-red-400">{fieldErrors.projectId}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm text-text-muted">
              {t("checklists.form.title")} <span className="text-red-400">*</span>
            </label>
            <input
              className={`w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.title ? "border-red-500" : ""}`}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setFieldErrors((e) => ({ ...e, title: "" })); }}
              placeholder={t("checklists.form.titlePlaceholder")}
            />
            {fieldErrors.title ? (
              <p className="text-xs text-red-400">{fieldErrors.title}</p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-text-muted">{t("checklists.form.status")}</label>
              <select
                className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "active" | "archived")}
              >
                <option value="draft">{t("checklists.status.draft")}</option>
                <option value="active">{t("checklists.status.active")}</option>
                <option value="archived">{t("checklists.status.archived")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-text-muted">{t("checklists.form.tagsLabel")}</label>
              <input
                className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t("checklists.form.tagsPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-text-muted">
                {t("checklists.form.items")} <span className="text-red-400">*</span>
              </label>
            </div>
            {fieldErrors.items ? (
              <p className="text-xs text-red-400">{fieldErrors.items}</p>
            ) : null}
            <div className="overflow-hidden rounded-xl border border-surface-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-2 bg-surface-2/80">
                    <th className="w-10 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{t("common.form.no")}</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{t("testCases.form.stepField")}</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">{t("testCases.form.expectedResult")}</th>
                    <th className="w-20 px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-2">
                  {items.map((it, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-surface-1" : "bg-surface-2/30"}>
                      <td className="px-3 py-2 align-top pt-3 text-text-muted">{idx + 1}</td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-start gap-2">
                          <label className="mt-2.5 flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-text-muted">
                            <input
                              type="checkbox"
                              checked={it.checked}
                              onChange={(e) =>
                                setItems((v) =>
                                  v.map((x, i) => (i === idx ? { ...x, checked: e.target.checked } : x))
                                )
                              }
                              className="h-4 w-4 rounded border-surface-2 text-brand-600 focus:ring-2 focus:ring-brand-500"
                            />
                            {t("common.completed")}
                          </label>
                          <textarea
                            rows={2}
                            className="min-h-[52px] w-full flex-1 resize-y rounded-md border border-surface-2 bg-surface-2 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={it.text}
                            onChange={(e) =>
                              setItems((v) =>
                                v.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x))
                              )
                            }
                            placeholder={t("testCases.form.step", { n: idx + 1 })}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <textarea
                          rows={2}
                          className="min-h-[52px] w-full resize-y rounded-md border border-surface-2 bg-surface-2 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={it.expectedResult}
                          onChange={(e) =>
                            setItems((v) =>
                              v.map((x, i) => (i === idx ? { ...x, expectedResult: e.target.value } : x))
                            )
                          }
                          placeholder={t("testCases.form.expectedResult")}
                        />
                      </td>
                      <td className="px-3 py-2 align-top pt-2">
                        <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-surface-2 px-2 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-2 hover:text-text-primary"
                          onClick={() => setItems((v) => v.filter((_, i) => i !== idx))}
                        >
                          {t("common.remove")}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-surface-2 px-2 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-2 hover:text-text-primary"
                          onClick={() => insertItemAfter(idx)}
                        >
                          {t("checklists.form.addItem")}
                        </button>
                      </div>
                      </td>
                    </tr>
                  ))}
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
