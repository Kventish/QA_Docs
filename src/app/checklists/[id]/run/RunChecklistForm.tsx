"use client";

import { useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/useT";

type Item = { text: string; expectedResult?: string };

type ItemState = { done: boolean; note: string };

type Props = {
  id: string;
  title: string;
  items: Item[];
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{children}</h2>
  );
}

export default function RunChecklistForm({ id, title, items }: Props) {
  const locale = useLocale();
  const t = useT();
  const [status, setStatus] = useState<"passed" | "failed">("passed");
  const [notes, setNotes] = useState("");
  const [itemStates, setItemStates] = useState<ItemState[]>(
    items.map(() => ({ done: false, note: "" }))
  );
  const [attachments, setAttachments] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const completedCount = useMemo(
    () => itemStates.filter((item) => item.done).length,
    [itemStates]
  );

  function updateItem(index: number, patch: Partial<ItemState>) {
    setItemStates((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("status", status);
    formData.append("notes", notes);
    formData.append("itemResults", JSON.stringify(itemStates.map((item, index) => ({ index, done: item.done, note: item.note }))));
    attachments.forEach((file) => formData.append("attachments", file));

    const res = await fetch(`/api/checklists/${id}/run`, {
      method: "POST",
      body: formData
    }).catch(() => null);

    if (!res) {
      setMessage(t("checklists.run.error", { locale }));
      setSaving(false);
      return;
    }

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(json?.error ?? t("checklists.run.error", { locale }));
      setSaving(false);
      return;
    }

    const runId = json?.run?.id as string | undefined;
    if (runId) {
      window.location.assign(`/checklists/${id}/runs/${runId}`);
      return;
    }
    setMessage(t("checklists.run.success", { locale }));
    setSaving(false);
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
        <div>
          <div className="text-sm text-text-muted">{t("checklists.viewLabel", { locale })}</div>
          <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        </div>

        <div className="mt-6 space-y-3">
          <SectionTitle>{t("checklists.run.sectionItems", { locale })}</SectionTitle>
          <div className="rounded-xl border border-brand-500/25 bg-surface-2/80 p-4">
            <div className="flex items-center justify-between text-sm text-text-muted">
              <div>{t("checklists.run.itemsSummary", { locale })}</div>
              <div>
                {completedCount} / {items.length}
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {items.map((item, index) => (
                <div key={index} className="rounded-lg border border-border bg-surface-1 p-4">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={itemStates[index]?.done ?? false}
                        onChange={(e) => updateItem(index, { done: e.target.checked })}
                      />
                      {t("checklists.run.completeItem", { n: index + 1 })}
                    </label>
                  </div>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="text-text-muted">{item.text}</div>
                    {item.expectedResult ? (
                      <div className="text-xs text-text-muted">{t("checklists.run.expectedResult", { locale })}</div>
                    ) : null}
                    {item.expectedResult ? <div className="text-sm text-text-muted">{item.expectedResult}</div> : null}
                    <textarea
                      className="mt-2 w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder={t("checklists.run.itemNotePlaceholder", { locale })}
                      value={itemStates[index]?.note ?? ""}
                      onChange={(e) => updateItem(index, { note: e.target.value })}
                    />
                  </div>
                </div>
              ))}
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-text-muted/30 bg-surface-2 p-4 text-sm text-text-muted">
                  {t("checklists.run.noItems", { locale })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft space-y-4">
        <SectionTitle>{t("checklists.run.sectionOutcome", { locale })}</SectionTitle>
        <div className="space-y-3 pt-1">
          <label className="text-sm text-text-muted">{t("checklists.run.statusLabel", { locale })}</label>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" checked={status === "passed"} onChange={() => setStatus("passed")} />
              {t("checklists.run.pass", { locale })}
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" checked={status === "failed"} onChange={() => setStatus("failed")} />
              {t("checklists.run.fail", { locale })}
            </label>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-text-muted">{t("checklists.run.notes", { locale })}</label>
          <textarea
            className="min-h-[90px] w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("checklists.run.notesPlaceholder", { locale })}
          />
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border/80 bg-surface-2/40 p-6 shadow-soft">
        <SectionTitle>{t("checklists.run.sectionAttachments", { locale })}</SectionTitle>
        <div className="mt-3 space-y-1">
          <label className="text-sm text-text-muted">{t("checklists.run.attachmentsLabel", { locale })}</label>
          <input
            type="file"
            multiple
            className="w-full text-sm"
            onChange={(event) => setAttachments((prev) => [...prev, ...Array.from(event.target.files ?? [])])}
          />
          {attachments.length > 0 ? (
            <div className="mt-2 text-sm text-text-muted">{attachments.map((file) => file.name).join(", ")}</div>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700">{message}</div>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? t("common.loading", { locale }) : t("checklists.run.submit", { locale })}
      </button>
    </form>
  );
}
