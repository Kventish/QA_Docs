"use client";

import { useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/useT";

type TestCasePlanItem = {
  id: string;
  title: string;
  description: string;
  preconditions: string;
  expected: string;
  status: string;
  flatSteps: Array<{ step: string; expectedResult: string; sourceTitle?: string }>;
};

type ChecklistPlanItem = {
  id: string;
  title: string;
  itemsJson: any;
  status: string;
};

type Props = {
  id: string;
  title: string;
  objective: string;
  scope: string;
  cases: TestCasePlanItem[];
  checklists: ChecklistPlanItem[];
};

export default function RunTestPlanForm({ id, title, objective, scope, cases, checklists }: Props) {
  const locale = useLocale();
  const t = useT();
  const [status, setStatus] = useState<"passed" | "failed">("passed");
  const [summary, setSummary] = useState("");
  const [caseStepDone, setCaseStepDone] = useState<boolean[][]>(() =>
    cases.map((item) => item.flatSteps.map(() => false))
  );
  const [checklistItemDone, setChecklistItemDone] = useState<boolean[][]>(() =>
    checklists.map((item) => (Array.isArray(item.itemsJson) ? item.itemsJson.map(() => false) : []))
  );
  const [attachments, setAttachments] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const caseProgress = useMemo(
    () => caseStepDone.map((steps) => steps.filter(Boolean).length),
    [caseStepDone]
  );

  const checklistProgress = useMemo(
    () => checklistItemDone.map((items) => items.filter(Boolean).length),
    [checklistItemDone]
  );

  function updateCaseStepDone(planIndex: number, stepIndex: number, done: boolean) {
    setCaseStepDone((prev) =>
      prev.map((steps, idx) =>
        idx === planIndex ? steps.map((value, stepIdx) => (stepIdx === stepIndex ? done : value)) : steps
      )
    );
  }

  function updateChecklistItemDone(planIndex: number, itemIndex: number, done: boolean) {
    setChecklistItemDone((prev) =>
      prev.map((items, idx) =>
        idx === planIndex ? items.map((value, itemIdx) => (itemIdx === itemIndex ? done : value)) : items
      )
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("status", status);
    formData.append("summary", summary);
    attachments.forEach((file) => formData.append("attachments", file));

    const res = await fetch(`/api/test-plans/${id}/run`, {
      method: "POST",
      body: formData
    }).catch(() => null);

    if (!res) {
      setMessage(t("testPlans.run.error", { locale }));
      setSaving(false);
      return;
    }

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(json?.error ?? t("testPlans.run.error", { locale }));
      setSaving(false);
      return;
    }

    setMessage(t("testPlans.run.success", { locale }));
    setSaving(false);
  }

  return (
    <form className="space-y-6 rounded-xl border bg-surface-1 p-6 shadow-soft" onSubmit={onSubmit}>
      <div>
        <div className="text-sm text-text-muted">{t("testPlans.viewLabel", { locale })}</div>
        <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      </div>

      {objective ? (
        <div className="space-y-1">
          <div className="text-xs text-text-muted">{t("testPlans.objective", { locale })}</div>
          <div className="whitespace-pre-wrap text-sm text-text-muted">{objective}</div>
        </div>
      ) : null}

      {scope ? (
        <div className="space-y-1">
          <div className="text-xs text-text-muted">{t("testPlans.scope", { locale })}</div>
          <div className="whitespace-pre-wrap text-sm text-text-muted">{scope}</div>
        </div>
      ) : null}

      <div className="rounded-xl border bg-surface-2 p-4">
        <div className="mb-3 text-sm font-medium text-text-muted">{t("testPlans.run.includedItems", { locale })}</div>
        <div className="space-y-6">
          <div>
            <div className="text-xs text-text-muted">{t("testPlans.run.includedTestCases", { locale })}</div>
            {cases.length > 0 ? (
              <div className="mt-3 space-y-4">
                {cases.map((item, index) => (
                  <section key={item.id} className="rounded-xl border bg-surface-1 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-text">{item.title}</div>
                        <div className="mt-1 text-sm text-text-muted">{t(`testCases.status.${item.status}` as any, { locale })}</div>
                      </div>
                    </div>
                    {item.description ? (
                      <div className="mt-4 text-sm text-text-muted">
                        <div className="font-medium text-text">{t("testCases.description", { locale })}</div>
                        <div className="mt-1 text-text">{item.description}</div>
                      </div>
                    ) : null}
                    {item.preconditions ? (
                      <div className="mt-4 text-sm text-text-muted">
                        <div className="font-medium text-text">{t("testCases.preconditions", { locale })}</div>
                        <div className="mt-1 text-text">{item.preconditions}</div>
                      </div>
                    ) : null}
                    {item.expected ? (
                      <div className="mt-4 text-sm text-text-muted">
                        <div className="font-medium text-text">{t("testCases.expectedResult", { locale })}</div>
                        <div className="mt-1 text-text">{item.expected}</div>
                      </div>
                    ) : null}
                    {item.flatSteps.length > 0 ? (
                      <div className="mt-4 text-sm text-text-muted">
                        <div className="mb-3 flex items-center justify-between text-sm font-medium text-text-muted">
                          <span>{t("testCases.run.stepsLabel", { locale })}</span>
                          <span>
                            {caseProgress[index]} / {item.flatSteps.length}
                          </span>
                        </div>
                        <ul className="mt-3 space-y-2">
                          {item.flatSteps.map((step, idx: number) => (
                            <li key={idx} className="rounded-xl border bg-surface-2 p-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <label className="inline-flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={caseStepDone[index]?.[idx] ?? false}
                                    onChange={(event) => updateCaseStepDone(index, idx, event.target.checked)}
                                  />
                                  {t("testCases.stepLabel", { n: idx + 1 })}
                                </label>
                                {step.sourceTitle ? (
                                  <span className="text-xs text-text-muted">
                                    {t("testCases.form.includedFrom", { locale })}: {step.sourceTitle}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 text-text">{step.step || t("testCases.emptyText", { locale })}</div>
                              {step.expectedResult ? (
                                <div className="mt-2 text-xs text-text-muted">{t("testCases.expectedResult", { locale })}</div>
                              ) : null}
                              {step.expectedResult ? <div className="text-text">{step.expectedResult}</div> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-text-muted">{t("testPlans.run.noTestCases", { locale })}</div>
            )}
          </div>

          <div>
            <div className="text-xs text-text-muted">{t("testPlans.run.includedChecklists", { locale })}</div>
            {checklists.length > 0 ? (
              <div className="mt-3 space-y-4">
                {checklists.map((item, index) => (
                  <section key={item.id} className="rounded-xl border bg-surface-1 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-text">{item.title}</div>
                        <div className="mt-1 text-sm text-text-muted">{t(`checklists.status.${item.status}` as any, { locale })}</div>
                      </div>
                    </div>
                    {Array.isArray(item.itemsJson) && item.itemsJson.length > 0 ? (
                      <div className="mt-4 text-sm text-text-muted">
                        <div className="mb-3 flex items-center justify-between text-sm font-medium text-text-muted">
                          <span>{t("checklists.itemsLabel", { locale })}</span>
                          <span>{checklistProgress[index]} / {item.itemsJson.length}</span>
                        </div>
                        <ul className="mt-3 space-y-2">
                          {item.itemsJson.map((entry: any, idx: number) => (
                            <li key={idx} className="rounded-xl border bg-surface-2 p-3">
                              <div className="flex items-center gap-3">
                                <label className="inline-flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={checklistItemDone[index]?.[idx] ?? false}
                                    onChange={(event) => updateChecklistItemDone(index, idx, event.target.checked)}
                                  />
                                  {t("testCases.stepLabel", { n: idx + 1 })}
                                </label>
                              </div>
                              <div className="mt-2 text-text">{entry.text || t("checklists.emptyText", { locale })}</div>
                              {entry.expectedResult ? (
                                <div className="mt-2 text-xs text-text-muted">{t("checklists.run.expectedResult", { locale })}</div>
                              ) : null}
                              {entry.expectedResult ? <div className="text-text">{entry.expectedResult}</div> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="mt-4 text-sm text-text-muted">{t("checklists.run.noItems", { locale })}</div>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-text-muted">{t("testPlans.run.noChecklists", { locale })}</div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm text-text-muted">{t("testPlans.run.statusLabel", { locale })}</label>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" checked={status === "passed"} onChange={() => setStatus("passed")} />
            {t("testPlans.run.pass", { locale })}
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" checked={status === "failed"} onChange={() => setStatus("failed")} />
            {t("testPlans.run.fail", { locale })}
          </label>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm text-text-muted">{t("testPlans.run.summaryLabel", { locale })}</label>
        <textarea
          className="min-h-[120px] w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={t("testPlans.run.summaryPlaceholder", { locale })}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm text-text-muted">{t("testPlans.run.attachmentsLabel", { locale })}</label>
        <input
          type="file"
          multiple
          className="w-full text-sm"
          onChange={(event) => setAttachments((prev) => [...prev, ...Array.from(event.target.files ?? [])])}
        />
        {attachments.length > 0 ? (
          <div className="mt-2 text-sm text-text-muted">
            {attachments.map((file) => file.name).join(", ")}
          </div>
        ) : null}
      </div>

      {message ? <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-700">{message}</div> : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? t("common.loading", { locale }) : t("testPlans.run.submit", { locale })}
      </button>
    </form>
  );
}
