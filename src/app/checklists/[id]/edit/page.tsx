"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { ProjectFormSelect } from "@/components/ProjectSelect";

type Item = { text: string; checked: boolean; expectedResult: string };
type Checklist = {
  id: string;
  projectId: string;
  title: string;
  status: "draft" | "active" | "archived";
  tags: string[];
  itemsJson?: unknown;
};
type Project = { id: string; name: string; slug: string };

const emptyItem: Item = { text: "", checked: false, expectedResult: "" };

function parseItems(cl: Checklist): Item[] {
  const raw = cl.itemsJson;
  if (!Array.isArray(raw) || raw.length === 0) return [{ ...emptyItem }];
  return raw.map((x: Record<string, unknown>) => ({
    text: typeof x.text === "string" ? x.text : "",
    checked: typeof x.checked === "boolean" ? x.checked : false,
    expectedResult: typeof x.expectedResult === "string" ? x.expectedResult : ""
  }));
}

export default function EditChecklistPage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<Project[]>([]);

  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<Checklist["status"]>("draft");
  const [tags, setTags] = useState("");
  const [items, setItems] = useState<Item[]>([{ ...emptyItem }]);

  const t = useT();

  useEffect(() => {
    fetch("/api/projects", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setProjects((j?.projects ?? []) as Project[]))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/checklists/${params.id}`, { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => {
        if (!alive) return;
        const cl: Checklist | null = j?.checklist ?? null;
        if (!cl) {
          setError("Checklist not found");
          return;
        }
        setProjectId(cl.projectId ?? "");
        setTitle(cl.title ?? "");
        setStatus(cl.status ?? "draft");
        setTags((cl.tags ?? []).join(", "));
        setItems(parseItems(cl));
      })
      .catch((r) => {
        if (!alive) return;
        if (r?.status === 401) {
          window.location.assign(`/login?next=${encodeURIComponent(`/checklists/${params.id}/edit`)}`);
          return;
        }
        setError("Не удалось загрузить чек‑лист");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [params.id]);

  function validate() {
    const next: Record<string, string> = {};
    if (!projectId.trim()) next.projectId = "Выберите проект";
    if (!title.trim()) next.title = "Укажите название";
    if (!items.some((it) => it.text.trim())) next.items = "Добавьте хотя бы один пункт";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function insertItemAfter(afterIndex: number) {
    setItems((v) => [...v.slice(0, afterIndex + 1), { ...emptyItem }, ...v.slice(afterIndex + 1)]);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validate()) return;

    setSaving(true);
    const res = await fetch(`/api/checklists/${params.id}`, {
      method: "PATCH",
      credentials: "include",
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
      setError("Не удалось сохранить");
      return;
    }
    const json = (await res.json().catch(() => null)) as { error?: string };
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent(`/checklists/${params.id}/edit`)}`);
      return;
    }
    if (res.status === 403) {
      setSaving(false);
      setError("Недостаточно прав (нужна роль editor/admin)");
      return;
    }
    if (!res.ok) {
      setSaving(false);
      setError(json?.error ?? "Не удалось сохранить");
      return;
    }

    window.location.assign(`/checklists/${params.id}`);
  }

  if (loading) return <div className="text-sm text-text-muted">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <div className="text-sm text-text-muted">Checklist</div>
        <h1 className="mt-1 text-xl font-semibold">Edit</h1>
      </div>

      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
        <form className="space-y-3" onSubmit={onSave}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-text-muted">Project <span className="text-red-400">*</span></label>
              <ProjectFormSelect
                projects={projects}
                value={projectId}
                onChange={(id) => {
                  setProjectId(id);
                  setFieldErrors((prev) => ({ ...prev, projectId: "" }));
                }}
                firstOptionKey="testPlans.selectProject"
                className={`w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.projectId ? "border-red-500" : ""}`}
              />
              {fieldErrors.projectId ? <p className="text-xs text-red-400">{fieldErrors.projectId}</p> : null}
            </div>
            <div className="space-y-1">
              <label className="text-sm text-text-muted">Status</label>
              <select
                className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={status}
                onChange={(e) => setStatus(e.target.value as Checklist["status"])}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-text-muted">{t("checklists.form.title")} <span className="text-red-400">*</span></label>
              <input
                className={`w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${fieldErrors.title ? "border-red-500" : ""}`}
                value={title}
                onChange={(e) => { setTitle(e.target.value); setFieldErrors((e) => ({ ...e, title: "" })); }}
              />
              {fieldErrors.title ? (
                <p className="text-xs text-red-400">{t("validation.titleRequired")}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label className="text-sm text-text-muted">Tags (comma)</label>
              <input
                className="w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-text-muted">Items <span className="text-red-400">*</span></label>
            </div>
            {fieldErrors.items ? <p className="text-xs text-red-400">{fieldErrors.items}</p> : null}

            <div className="overflow-hidden rounded-xl border border-surface-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-2 bg-surface-2/80">
                    <th className="w-10 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">№</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Шаг</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Ожидаемый результат</th>
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
                                setItems((v) => v.map((x, i) => (i === idx ? { ...x, checked: e.target.checked } : x)))
                              }
                              className="h-4 w-4 rounded border-surface-2 text-brand-600 focus:ring-2 focus:ring-brand-500"
                            />
                            Выполнено
                          </label>
                          <textarea
                            rows={2}
                            className="min-h-[52px] w-full flex-1 resize-y rounded-md border border-surface-2 bg-surface-2 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            value={it.text}
                            onChange={(e) =>
                              setItems((v) => v.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)))
                            }
                            placeholder={`Шаг ${idx + 1}`}
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
                          placeholder="Ожидаемый результат"
                        />
                      </td>
                      <td className="px-3 py-2 align-top pt-2">
                        <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-surface-2 px-2 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-2 hover:text-text-primary"
                          onClick={() => setItems((v) => v.filter((_, i) => i !== idx))}
                        >
                          Удалить
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-surface-2 px-2 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-2 hover:text-text-primary"
                          onClick={() => insertItemAfter(idx)}
                        >
                          Добавить
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
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">{error}</div>
          ) : null}

          <div className="flex gap-2">
            <button
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-500 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <a
              className="rounded-lg border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-1"
              href={`/checklists/${params.id}`}
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
