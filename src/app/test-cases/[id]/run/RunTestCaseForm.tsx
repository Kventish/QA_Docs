"use client";

import { useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/useT";

type Step = { step?: string; expectedResult?: string; actualResult?: string; sourceTitle?: string };

type Props = {
  id: string;
  title: string;
  description: string;
  preconditions: string;
  postconditions: string;
  expectedResult: string;
  steps: Step[];
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{children}</h2>
  );
}

export default function RunTestCaseForm({
  id,
  title,
  description,
  preconditions,
  postconditions,
  expectedResult,
  steps
}: Props) {
  const locale = useLocale();
  const t = useT();
  const [status, setStatus] = useState<"passed" | "failed">("passed");
  const [actualResult, setActualResult] = useState("");
  const [notes, setNotes] = useState("");
  const [stepDone, setStepDone] = useState<boolean[]>(() => steps.map(() => false));
  const [attachments, setAttachments] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const completedStepCount = useMemo(() => stepDone.filter(Boolean).length, [stepDone]);

  const hasContext = Boolean(
    description.trim() || preconditions.trim() || postconditions.trim() || expectedResult.trim()
  );

  function updateStepDone(index: number, done: boolean) {
    setStepDone((prev) => prev.map((value, idx) => (idx === index ? done : value)));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("status", status);
    formData.append("actualResult", actualResult);
    formData.append("notes", notes);
    formData.append(
      "stepResults",
      JSON.stringify(stepDone.map((done, index) => ({ index, done, note: "" })))
    );
    attachments.forEach((file) => formData.append("attachments", file));

    const res = await fetch(`/api/test-cases/${id}/run`, {
      method: "POST",
      body: formData
    }).catch(() => null);

    if (!res) {
      setMessage(t("testCases.run.error", { locale }));
      setSaving(false);
      return;
    }

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(json?.error ?? t("testCases.run.error", { locale }));
      setSaving(false);
      return;
    }

    setMessage(t("testCases.run.success", { locale }));
    setSaving(false);
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft">
        <div>
          <div className="text-sm text-text-muted">{t("testCases.viewLabel", { locale })}</div>
          <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        </div>

        {hasContext ? (
          <div className="mt-6 space-y-3 rounded-lg border border-border bg-surface-2/60 p-4">
            <SectionTitle>{t("testCases.run.sectionCaseContext", { locale })}</SectionTitle>
            {description ? (
              <div className="space-y-1 pt-1">
                <div className="text-xs text-text-muted">{t("testCases.description", { locale })}</div>
                <div className="whitespace-pre-wrap text-sm text-text-muted">{description}</div>
              </div>
            ) : null}
            {preconditions ? (
              <div className="space-y-1">
                <div className="text-xs text-text-muted">{t("testCases.preconditions", { locale })}</div>
                <div className="whitespace-pre-wrap text-sm text-text-muted">{preconditions}</div>
              </div>
            ) : null}
            {expectedResult ? (
              <div className="space-y-1">
                <div className="text-xs text-text-muted">{t("testCases.expectedResult", { locale })}</div>
                <div className="whitespace-pre-wrap text-sm text-text-muted">{expectedResult}</div>
              </div>
            ) : null}
            {postconditions ? (
              <div className="space-y-1">
                <div className="text-xs text-text-muted">{t("testCases.postconditions", { locale })}</div>
                <div className="whitespace-pre-wrap text-sm text-text-muted">{postconditions}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {steps.length > 0 ? (
          <div className="mt-6 space-y-3">
            <SectionTitle>{t("testCases.run.sectionSteps", { locale })}</SectionTitle>
            <div className="rounded-xl border border-brand-500/25 bg-surface-2/80 p-4">
              <div className="mb-3 flex items-center justify-between text-sm font-medium text-text-muted">
                <span>{t("testCases.run.stepsLabel", { locale })}</span>
                <span>
                  {completedStepCount} / {steps.length}
                </span>
              </div>
              <div className="space-y-4">
                {steps.map((step, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-surface-1 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={stepDone[idx]}
                          onChange={(event) => updateStepDone(idx, event.target.checked)}
                        />
                        {t("testCases.stepLabel", { n: idx + 1 })}
                      </label>
                      {step.sourceTitle ? (
                        <span className="text-xs text-text-muted">
                          {t("testCases.form.includedFrom", { locale })}: {step.sourceTitle}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm">{step.step || t("testCases.emptyText", { locale })}</div>
                    <div className="mt-3 text-xs text-text-muted">{t("testCases.expectedResult", { locale })}</div>
                    <div className="mt-1 text-sm">{step.expectedResult || t("testCases.emptyText", { locale })}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-surface-1 p-6 shadow-soft space-y-4">
        <SectionTitle>{t("testCases.run.sectionOutcome", { locale })}</SectionTitle>
        <div className="space-y-3 pt-1">
          <div className="text-sm text-text-muted">{t("testCases.run.statusLabel", { locale })}</div>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" checked={status === "passed"} onChange={() => setStatus("passed")} />
              {t("testCases.run.pass", { locale })}
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" checked={status === "failed"} onChange={() => setStatus("failed")} />
              {t("testCases.run.fail", { locale })}
            </label>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-text-muted">{t("testCases.run.actualResultLabel", { locale })}</label>
          <textarea
            className="min-h-[120px] w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={actualResult}
            onChange={(e) => setActualResult(e.target.value)}
            placeholder={t("testCases.run.actualResultPlaceholder", { locale })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-text-muted">{t("testCases.run.notes", { locale })}</label>
          <textarea
            className="min-h-[90px] w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border/80 bg-surface-2/40 p-6 shadow-soft">
        <SectionTitle>{t("testCases.run.sectionAttachments", { locale })}</SectionTitle>
        <div className="mt-3 space-y-1">
          <label className="text-sm text-text-muted">{t("testCases.run.attachmentsLabel", { locale })}</label>
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
        {saving ? t("common.loading", { locale }) : t("testCases.run.submit", { locale })}
      </button>
    </form>
  );
}
