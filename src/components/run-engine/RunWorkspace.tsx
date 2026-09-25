"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { RunViewJson } from "@/lib/run-engine/service";
import { calculateStatus, documentPaths, durationText, ExecutionSeverity, Result, SnapshotStep } from "@/lib/run-engine/domain";
import { useLocale } from "@/lib/i18n/useT";
import { runLabels, runErrorLabel, RunLabels } from "@/lib/i18n/dictionaries/run-engine";

const inputClass = "mt-1 w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
const buttonClass = "inline-flex items-center justify-center rounded-lg border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass = "inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50";

function statusClass(status: string | null) {
  if (status === "passed" || status === "completed") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
  if (status === "failed" || status === "cancelled") return "border-red-500/40 bg-red-500/10 text-red-400";
  if (status === "questionable") return "border-amber-500/40 bg-amber-500/10 text-amber-400";
  if (status === "in_progress") return "border-brand-500/40 bg-brand-500/10 text-brand-500";
  return "border-border bg-surface-2 text-text-muted";
}

type Step = RunViewJson["steps"][number];
type StepDraft = { result: Result | null; severity: ExecutionSeverity | null; actualResult: string };
type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";
type CancelPreparation = "saved" | "discard" | "error";
type StepSaveHandle = { flush: () => Promise<boolean>; prepareCancel: () => Promise<CancelPreparation> };
type StepState = { result: Result | null; valid: boolean; dirty: boolean; status: SaveStatus };
type MutationResult = { ok: boolean; error?: string; runId?: string };
type AggregateMutation = (path: string, data: Record<string, unknown> | FormData, method?: string, key?: string) => Promise<MutationResult>;

function sameDraft(left: StepDraft, right: StepDraft) {
  return left.result === right.result && left.severity === right.severity && left.actualResult === right.actualResult;
}

function StepEditor({ definition, step, runId, canEdit, aggregateMutation, registerSave, onState, onAutoStatus, r, locale }: {
  definition: SnapshotStep;
  step: Step;
  runId: string;
  canEdit: boolean;
  aggregateMutation: AggregateMutation;
  registerSave: (id: string, handle: StepSaveHandle | null) => void;
  onState: (id: string, state: StepState) => void;
  onAutoStatus: (status: Result | null) => void;
  r: RunLabels;
  locale: string;
}) {
  const initial: StepDraft = { result: step.result, severity: step.severity, actualResult: step.actualResult };
  const [result, setResult] = useState<Result | null>(initial.result);
  const [severity, setSeverity] = useState<ExecutionSeverity | null>(initial.severity);
  const [actualResult, setActualResult] = useState(initial.actualResult);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [comments, setComments] = useState(step.comments);
  const [comment, setComment] = useState("");
  const commentRef = useRef("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [attachments, setAttachments] = useState(step.attachments);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const desiredRef = useRef<StepDraft>(initial);
  const savedRef = useRef<StepDraft & { revision: number }>({ ...initial, revision: step.revision });
  const queueRef = useRef<Promise<boolean> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publishState = useCallback((status: SaveStatus = saveStatus) => {
    const desired = desiredRef.current;
    onState(step.id, {
      result: desired.result,
      valid: desired.result !== "failed" || desired.severity !== null,
      dirty: !sameDraft(desired, savedRef.current) || Boolean(commentRef.current.trim()),
      status
    });
  }, [onState, saveStatus, step.id]);

  const drain = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    let savedAny = false;
    while (true) {
      const pending = queueRef.current;
      if (pending) {
        if (!await pending) return false;
        continue;
      }
      if (sameDraft(desiredRef.current, savedRef.current)) {
        const status: SaveStatus = savedAny ? "saved" : "idle";
        setSaveStatus(status);
        publishState(status);
        if (savedAny) {
          if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
          savedIndicatorRef.current = setTimeout(() => setSaveStatus("idle"), 1500);
        }
        return true;
      }

      const draft = { ...desiredRef.current };
      if (draft.result === "failed" && draft.severity === null) {
        setSaveError("");
        setSaveStatus("idle");
        publishState("idle");
        return false;
      }
      setSaveStatus("saving");
      setSaveError("");
      publishState("saving");

      const operation = (async () => {
        let response: Response;
        try {
          response = await fetch(`/api/v2/runs/${runId}/steps/${step.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...draft, stepRevision: savedRef.current.revision })
          });
        } catch {
          setSaveError("network"); setSaveStatus("error"); publishState("error"); return false;
        }
        const json = await response.json().catch(() => null);
        if (!response.ok) {
          const code = json?.error ?? "serverError";
          setSaveError(code);
          setSaveStatus(code === "conflict" ? "conflict" : "error");
          publishState(code === "conflict" ? "conflict" : "error");
          return false;
        }
        savedRef.current = { ...draft, revision: json.step.revision };
        onAutoStatus(json.autoStatus ?? null);
        return true;
      })();
      let tracked: Promise<boolean>;
      tracked = operation.finally(() => {
        if (queueRef.current === tracked) queueRef.current = null;
      });
      queueRef.current = tracked;
      if (!await tracked) return false;
      savedAny = true;
    }
  }, [onAutoStatus, publishState, runId, step.id]);

  const schedule = useCallback((draft: StepDraft, delay: number) => {
    desiredRef.current = draft;
    setSaveError("");
    const valid = draft.result !== "failed" || draft.severity !== null;
    const dirty = !sameDraft(draft, savedRef.current);
    onState(step.id, { result: draft.result, valid, dirty, status: dirty && valid ? "saving" : "idle" });
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!dirty || !valid || !canEdit) {
      timerRef.current = null;
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("saving");
    timerRef.current = setTimeout(() => { timerRef.current = null; void drain(); }, delay);
  }, [canEdit, drain, onState, step.id]);

  const flush = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (desiredRef.current.result === "failed" && desiredRef.current.severity === null) {
      setSaveStatus("idle"); publishState("idle"); return false;
    }
    if (commentRef.current.trim()) return false;
    return drain();
  }, [drain, publishState]);

  const prepareCancel = useCallback(async (): Promise<CancelPreparation> => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const invalidDraft = desiredRef.current.result === "failed" && desiredRef.current.severity === null;
    if (invalidDraft) {
      if (queueRef.current) await queueRef.current;
      return sameDraft(desiredRef.current, savedRef.current) && !commentRef.current.trim() ? "saved" : "discard";
    }
    if (!await drain()) return "error";
    return commentRef.current.trim() ? "discard" : "saved";
  }, [drain]);

  useEffect(() => {
    registerSave(step.id, { flush, prepareCancel });
    publishState();
    return () => registerSave(step.id, null);
  }, [flush, prepareCancel, publishState, registerSave, step.id]);
  useEffect(() => setAttachments(step.attachments), [step.attachments]);
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
  }, []);

  async function addComment(event: FormEvent) {
    event.preventDefault();
    const body = comment.trim();
    if (!body || commentBusy) return;
    setCommentBusy(true); setCommentError(""); publishState("saving");
    try {
      const response = await fetch(`/api/v2/runs/${runId}/steps/${step.id}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body })
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) { setCommentError(json?.error ?? "serverError"); return; }
      setComments(previous => [...previous, json.comment]);
      commentRef.current = ""; setComment("");
    } catch { setCommentError("network"); }
    finally { setCommentBusy(false); publishState(); }
  }

  async function upload(file: File) {
    setUploading(true); setUploadError("");
    const form = new FormData(); form.append("file", file); form.append("stepRunResultId", step.id);
    const result = await aggregateMutation("/attachments", form);
    if (!result.ok) setUploadError(result.error ?? "serverError");
    setUploading(false);
  }

  return <section className={`space-y-5 rounded-xl border bg-surface-1 p-5 shadow-soft ${result === "failed" ? "border-red-500/40" : result === "questionable" ? "border-amber-500/40" : result === "passed" ? "border-emerald-500/30" : ""}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{r.step}</p><div className="mt-2 whitespace-pre-wrap font-medium">{definition.action}</div></div><span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(result)}`}>{r.states[result ?? "not_started"]}</span></div>
    {definition.includePath.length > 1 && <div className="text-xs text-text-muted">{r.includedFrom}: {definition.sourceTitle}</div>}
    <div className="rounded-lg bg-surface-2 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-text-muted">{r.expected}</div><div className="mt-2 whitespace-pre-wrap text-sm">{definition.expected || "—"}</div></div>
    <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">{r.result}<select aria-label={`${r.result}: ${definition.action}`} className={inputClass} value={result ?? ""} onChange={event => {
        const nextResult = (event.target.value || null) as Result | null;
        const nextSeverity = nextResult === "passed" || nextResult === null ? null : severity;
        setResult(nextResult); setSeverity(nextSeverity);
        schedule({ result: nextResult, severity: nextSeverity, actualResult }, 0);
      }}><option value="">{r.states.not_started}</option>{(["passed", "failed", "questionable"] as const).map(value => <option key={value} value={value}>{r.states[value]}</option>)}</select></label>
      {(result === "failed" || result === "questionable") && <label className="text-sm font-medium">{r.severity}{result === "failed" ? " *" : ""}<select aria-label={r.severity} className={inputClass} value={severity ?? ""} onChange={event => {
        const nextSeverity = (event.target.value || null) as ExecutionSeverity | null;
        setSeverity(nextSeverity); schedule({ result, severity: nextSeverity, actualResult }, 0);
      }}><option value="">{r.none}</option>{(["low", "medium", "high", "critical"] as const).map(value => <option key={value} value={value}>{r.severities[value]}</option>)}</select></label>}
      {result === "failed" && severity === null && <p className="text-sm text-amber-500 sm:col-span-2">{r.severityRequired}</p>}
      <label className="text-sm font-medium sm:col-span-2">{r.actual}<textarea className={`${inputClass} min-h-24`} maxLength={20000} value={actualResult} onChange={event => {
        const nextActual = event.target.value;
        setActualResult(nextActual); schedule({ result, severity, actualResult: nextActual }, 500);
      }} /></label>
    </fieldset>
    <div className="flex min-h-6 items-center gap-3 text-xs" role="status">
      {saveStatus === "saving" && <span className="text-text-muted">{r.saving}</span>}
      {saveStatus === "saved" && <span className="text-emerald-400">{r.saved}</span>}
      {(saveStatus === "error" || saveStatus === "conflict") && <><span className="text-red-400">{saveStatus === "conflict" ? r.errors.conflict : `${r.saveFailed}: ${runErrorLabel(saveError, r)}`}</span><button className={buttonClass} onClick={() => saveStatus === "conflict" ? (confirm(r.reloadWarning) && window.location.reload()) : void drain()}>{saveStatus === "conflict" ? r.reload : r.retry}</button></>}
    </div>

    <div className="space-y-3 border-t border-border pt-4"><h3 className="text-sm font-semibold">{r.comments}</h3>
      {comments.map(entry => <div key={entry.id} className="rounded-lg border bg-surface-2 p-3"><div className="text-xs text-text-muted">{entry.authorEmailSnapshot} · {new Date(entry.createdAt).toLocaleString(locale)}</div><p className="mt-1 whitespace-pre-wrap text-sm">{entry.body}</p></div>)}
      {canEdit && <form onSubmit={addComment} className="space-y-2"><textarea aria-label={r.comments} className={`${inputClass} min-h-20`} maxLength={10000} value={comment} onChange={event => { commentRef.current = event.target.value; setComment(event.target.value); publishState(); }} /><button className={buttonClass} disabled={commentBusy || !comment.trim()}>{commentBusy ? r.saving : r.addComment}</button>{commentError && <p className="text-sm text-red-400">{runErrorLabel(commentError, r)}</p>}</form>}
    </div>

    <div className="space-y-3 border-t border-border pt-4"><h3 className="text-sm font-semibold">{r.attachments}</h3>
      {attachments.map(file => <div key={file.id} className="break-words text-sm"><a className="text-brand-500 underline" href={`/api/v2/attachments/${file.id}/download`}>{r.download}: {file.originalName}</a><span className="ml-2 text-text-muted">{file.size.toLocaleString(locale)} B · {file.uploadedByEmailSnapshot}</span></div>)}
      {canEdit && <label className="block text-sm">{r.fileHint}<input aria-label={r.upload} type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.log" disabled={uploading} className="mt-2 block w-full" onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file);
      }} /></label>}
      {uploading && <p className="text-xs text-text-muted">{r.uploading}</p>}{uploadError && <p className="text-sm text-red-400">{runErrorLabel(uploadError, r)}</p>}
    </div>
  </section>;
}

export default function RunWorkspace({ runId }: { runId: string }) {
  const router = useRouter();
  const locale = useLocale();
  const r = runLabels[locale];
  const [run, setRun] = useState<RunViewJson | null>(null);
  const runRef = useRef<RunViewJson | null>(null);
  const [error, setError] = useState("");
  const [aggregateBusy, setAggregateBusy] = useState(false);
  const aggregateBusyRef = useRef(false);
  const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
  const saveHandles = useRef(new Map<string, StepSaveHandle>());
  const [epoch, setEpoch] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const clockOffset = useRef(0);
  const [manual, setManual] = useState(false);
  const [finalStatus, setFinalStatus] = useState<Result>("passed");
  const [reason, setReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [runUploading, setRunUploading] = useState(false);
  const [runUploadError, setRunUploadError] = useState("");
  const [nextBusy, setNextBusy] = useState(false);
  const [nextError, setNextError] = useState("");

  const accept = useCallback((next: RunViewJson, resetSteps = false) => {
    clockOffset.current = Date.now() - Date.parse(next.serverNow);
    runRef.current = next; setRun(next);
    if (resetSteps) setStepStates(Object.fromEntries(next.steps.map(step => [step.id, {
      result: step.result, valid: step.result !== "failed" || step.severity !== null, dirty: false, status: "idle" as SaveStatus
    }])));
  }, []);
  const load = useCallback(async (resetSteps = true) => {
    try {
      const response = await fetch(`/api/v2/runs/${runId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) { setError(body.error ?? "serverError"); return false; }
      accept(body.run, resetSteps); setError(""); return true;
    } catch { setError("network"); return false; }
  }, [runId, accept]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const registerSave = useCallback((id: string, handle: StepSaveHandle | null) => {
    if (handle) saveHandles.current.set(id, handle); else saveHandles.current.delete(id);
  }, []);
  const onStepState = useCallback((id: string, state: StepState) => setStepStates(previous => ({ ...previous, [id]: state })), []);
  const onAutoStatus = useCallback((autoStatus: Result | null) => {
    setRun(previous => previous ? { ...previous, autoStatus } : previous);
    if (runRef.current) runRef.current = { ...runRef.current, autoStatus };
  }, []);
  const hasPendingSteps = Object.values(stepStates).some(state => state.dirty || state.status === "saving" || state.status === "error" || state.status === "conflict");
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => { if (hasPendingSteps || aggregateBusy) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [hasPendingSteps, aggregateBusy]);

  const aggregateMutation: AggregateMutation = useCallback(async (path, data, method = "POST", key) => {
    if (aggregateBusyRef.current || !runRef.current) return { ok: false, error: "saving" };
    aggregateBusyRef.current = true; setAggregateBusy(true); setError("");
    try {
      const headers: Record<string, string> = {};
      if (key) headers["Idempotency-Key"] = key;
      let body: BodyInit;
      if (data instanceof FormData) { data.set("revision", String(runRef.current.revision)); body = data; }
      else { headers["Content-Type"] = "application/json"; body = JSON.stringify({ ...data, revision: runRef.current.revision }); }
      const response = await fetch(`/api/v2/runs/${runId}${path}`, { method, headers, body });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        const code = json?.error ?? (response.status === 413 ? "fileSize" : "serverError");
        setError(code); return { ok: false, error: code };
      }
      if (json.run) accept(json.run);
      return { ok: true, runId: typeof json.runId === "string" ? json.runId : undefined };
    } catch { setError("network"); return { ok: false, error: "network" }; }
    finally { aggregateBusyRef.current = false; setAggregateBusy(false); }
  }, [accept, runId]);

  const flushSteps = useCallback(async () => {
    const results = await Promise.all([...saveHandles.current.values()].map(handle => handle.flush()));
    if (results.some(result => !result)) { setError("autosaveFailed"); return false; }
    return true;
  }, []);
  const completeMutation = useCallback(async (data: Record<string, unknown>) => {
    setError("");
    if (!await flushSteps()) return false;
    return (await aggregateMutation("/complete", data)).ok;
  }, [aggregateMutation, flushSteps]);
  const cancelMutation = useCallback(async () => {
    setError("");
    const preparations = await Promise.all([...saveHandles.current.values()].map(handle => handle.prepareCancel()));
    if (preparations.includes("error")) { setError("autosaveFailed"); return false; }
    if (preparations.includes("discard") && !confirm(r.cancelDiscardWarning)) return false;
    return (await aggregateMutation("/cancel", { reason: cancelReason })).ok;
  }, [aggregateMutation, cancelReason, r.cancelDiscardWarning]);

  const navigateSafely = useCallback(async (path: string) => {
    const current = runRef.current;
    if (!current) return;
    if (current.lifecycle === "in_progress" && current.canEdit) {
      const preparations = await Promise.all([...saveHandles.current.values()].map(handle => handle.prepareCancel()));
      if (preparations.includes("error")) { setError("autosaveFailed"); return; }
      if (preparations.includes("discard") && !confirm(r.navigateDiscardWarning)) return;
    }
    router.push(path);
  }, [r.navigateDiscardWarning, router]);

  const openNextPlanItem = useCallback(async () => {
    const context = runRef.current?.planContext;
    const next = context?.nextActionable;
    if (!context || !next || nextBusy) return;
    setNextBusy(true); setNextError("");
    try {
      if (next.childRunId) {
        router.push(`/runs/${next.childRunId}`);
        return;
      }
      const storageKey = `run-item-start:${next.id}`;
      const key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
      const response = await fetch(`/api/v2/runs/${context.planRunId}/items/${next.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ revision: context.planRevision })
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) { setNextError(json?.error ?? "serverError"); return; }
      sessionStorage.removeItem(storageKey);
      router.push(`/runs/${json.runId}`);
    } catch { setNextError("network"); }
    finally { setNextBusy(false); }
  }, [nextBusy, router]);

  const conflict = ["conflict", "closed", "unauthorized", "forbidden"].includes(error);
  function resultFor(stepId: string, fallback: Result | null) { return stepStates[stepId]?.result ?? fallback; }
  function renderSteps(definitions: SnapshotStep[]): React.ReactNode {
    return definitions.map(definition => {
      if (definition.children.length) {
        const values: (Result | null)[] = [];
        const gather = (nodes: SnapshotStep[]): void => { nodes.forEach(node => node.children.length ? gather(node.children) : (() => {
          const step = run!.steps.find(value => value.occurrenceKey === node.key); values.push(step ? resultFor(step.id, step.result) : null);
        })()); };
        gather(definition.children);
        const status = calculateStatus(values);
        return <section key={definition.key} className="space-y-4 rounded-xl border bg-surface-2/40 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{r.group}: {definition.action}</h2><span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(status)}`}>{status ? r.states[status] : r.states.not_started}</span></div>{definition.expected && <p>{r.expected}: {definition.expected}</p>}{renderSteps(definition.children)}</section>;
      }
      const step = run!.steps.find(value => value.occurrenceKey === definition.key);
      if (!step) return <p key={definition.key} role="alert">{r.errors.invalidDefinition}</p>;
      return <StepEditor key={`${step.id}:${epoch}`} definition={definition} step={step} runId={runId}
        canEdit={run!.canEdit && !conflict} aggregateMutation={aggregateMutation} registerSave={registerSave}
        onState={onStepState} onAutoStatus={onAutoStatus} r={r} locale={locale} />;
    });
  }
  const date = (value: string) => new Date(value).toLocaleString(locale);
  const canComplete = Boolean(run && (run.kind === "test_plan"
    ? run.planItems.length > 0 && run.planItems.every(item => ["passed", "failed", "questionable"].includes(item.state))
    : run.steps.length > 0 && run.steps.every(step => Boolean(stepStates[step.id]?.valid && stepStates[step.id]?.result))));
  const planCounts = run?.kind === "test_plan" ? run.planItems.reduce((counts, item) => {
    counts[item.state] += 1;
    return counts;
  }, { passed: 0, failed: 0, questionable: 0, in_progress: 0, not_started: 0, cancelled: 0 }) : null;
  const planCompleted = planCounts ? planCounts.passed + planCounts.failed + planCounts.questionable : 0;
  const planRemaining = planCounts ? planCounts.in_progress + planCounts.not_started : 0;
  const planPercent = run?.kind === "test_plan" && run.planItems.length ? Math.round(planCompleted / run.planItems.length * 100) : 0;

  async function uploadRunFile(file: File) {
    setRunUploading(true); setRunUploadError("");
    const form = new FormData(); form.append("file", file);
    const result = await aggregateMutation("/attachments", form);
    if (!result.ok) setRunUploadError(result.error ?? "serverError");
    setRunUploading(false);
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    {error && <div role="alert" className="space-y-2 rounded-xl border border-red-500 p-4"><p>{runErrorLabel(error, r)}</p><button className={buttonClass} disabled={aggregateBusy} onClick={async () => {
      if (hasPendingSteps && !confirm(r.reloadWarning)) return;
      if (await load()) setEpoch(value => value + 1);
    }}>{r.reload}</button></div>}
    {!run ? <p>{r.loading}</p> : <>
      {run.planContext && <section className="sticky top-3 z-10 rounded-xl border border-brand-500/40 bg-surface-1/95 p-4 shadow-soft backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><button className="text-sm font-medium text-brand-500 hover:text-brand-400" onClick={() => void navigateSafely(`/runs/${run.planContext!.planRunId}`)}>← {run.planContext.planTitle}</button>
            <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-sm text-text-muted">{r.planElement} {run.planContext.position} {r.of} {run.planContext.total}</span><span className="rounded-full border bg-surface-2 px-2 py-1 text-xs font-medium">{r.itemKinds[run.planContext.itemKind]}</span></div>
          </div>
          <button className={buttonClass} onClick={() => void navigateSafely(`/runs/${run.planContext!.planRunId}`)}>{r.returnToPlan}</button>
        </div>
      </section>}
      <header className="space-y-5 rounded-xl border bg-surface-1 p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-500">{r.runDetails}</p><h1 className="mt-2 text-2xl font-semibold">{run.definition.title}</h1><p className="mt-1 text-sm text-text-muted">{r.snapshot}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(run.finalStatus ?? run.autoStatus)}`}>{run.finalStatus || run.autoStatus ? r.states[(run.finalStatus ?? run.autoStatus)!] : r.states.not_started}</span><span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(run.lifecycle)}`}>{r.states[run.lifecycle]}</span><span className="rounded-lg border bg-surface-2 px-3 py-2 font-mono text-lg font-semibold">{durationText(run.durationMs ?? (clock - clockOffset.current - Date.parse(run.startedAt)))}</span></div></div>
        <nav className="flex flex-wrap gap-3"><button className={buttonClass} onClick={() => void navigateSafely(`/${documentPaths[run.kind]}/${run.definition.documentId}`)}>{r.back}</button><button className={buttonClass} onClick={() => void navigateSafely(`/${documentPaths[run.kind]}/${run.definition.documentId}/runs`)}>{r.history}</button>{run.parentRunId && !run.planContext && <button className={buttonClass} onClick={() => void navigateSafely(`/runs/${run.parentRunId}`)}>{r.parent}</button>}</nav>
        <dl className="grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3"><div><dt>{r.user}</dt><dd>{run.startedByEmailSnapshot}</dd></div><div><dt>{r.date}</dt><dd>{date(run.startedAt)}</dd></div><div><dt>{r.lifecycle}</dt><dd>{r.states[run.lifecycle]}</dd></div><div><dt>{r.duration}</dt><dd className="font-mono">{durationText(run.durationMs ?? (clock - clockOffset.current - Date.parse(run.startedAt)))}</dd></div><div><dt>{r.auto}</dt><dd>{run.autoStatus ? r.states[run.autoStatus] : "—"}</dd></div><div><dt>{r.final}</dt><dd>{run.finalStatus ? r.states[run.finalStatus] : "—"}</dd></div></dl>
        {run.lifecycle === "in_progress" && <p className="text-xs text-text-muted">{r.timerHint}</p>}
        {run.cancelledAt && <p>{r.states.cancelled}: {date(run.cancelledAt)} · {run.cancelledByEmailSnapshot}<br />{r.cancelledReason}: {run.cancelReason}</p>}
      </header>

      <section className="space-y-3 rounded-xl border bg-surface-1 p-5 shadow-soft"><h2 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{r.runAttachments}</h2>{run.attachments.map(file => <div key={file.id} className="break-words text-sm"><a className="text-brand-500 underline" href={`/api/v2/attachments/${file.id}/download`}>{r.download}: {file.originalName}</a><span className="ml-2 text-text-muted">{file.size.toLocaleString(locale)} B · {file.uploadedByEmailSnapshot}</span></div>)}
        {run.canEdit && <label className="block text-sm">{r.fileHint}<input aria-label={r.upload} type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.log" disabled={runUploading || conflict} className="mt-2 block w-full" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadRunFile(file); }} /></label>}
        {runUploading && <p className="text-xs text-text-muted">{r.uploading}</p>}{runUploadError && <p className="text-sm text-red-400">{runErrorLabel(runUploadError, r)}</p>}
      </section>

      {(["description", "preconditions", "postconditions", "expected", "objective", "scope"] as const).map(key => run.definition[key] ? <section key={key} className="rounded-xl border bg-surface-1 p-5 shadow-soft"><h2 className="text-sm font-semibold">{r[key]}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-muted">{run.definition[key]}</p></section> : null)}
      {renderSteps(run.definition.steps)}
      {run.kind === "test_plan" && planCounts && <section className="space-y-5">
        <div className="space-y-4 rounded-xl border bg-surface-1 p-5 shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{r.executionProgress}</h2><span className="text-sm font-medium">{planCompleted} / {run.planItems.length} {r.completedShort}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${planPercent}%` }} /></div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5"><div><dt className="text-text-muted">{r.states.passed}</dt><dd className="mt-1 font-semibold">{planCounts.passed}</dd></div><div><dt className="text-text-muted">{r.states.failed}</dt><dd className="mt-1 font-semibold">{planCounts.failed}</dd></div><div><dt className="text-text-muted">{r.states.questionable}</dt><dd className="mt-1 font-semibold">{planCounts.questionable}</dd></div><div><dt className="text-text-muted">{r.remaining}</dt><dd className="mt-1 font-semibold">{planRemaining}</dd></div><div><dt className="text-text-muted">{r.states.cancelled}</dt><dd className="mt-1 font-semibold">{planCounts.cancelled}</dd></div></dl>
        </div>
        {planCounts.in_progress > 0 && <div className="space-y-3 rounded-xl border border-brand-500/40 bg-brand-500/5 p-5"><h2 className="font-semibold">{r.unfinishedRuns}</h2>{run.planItems.filter(item => item.state === "in_progress").map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{item.title}</p><p className="text-xs text-text-muted">{r.itemKinds[item.kind]}{item.executor ? ` · ${item.executor}` : ""}</p></div>{item.childRunId && <Link className={primaryClass} href={`/runs/${item.childRunId}`}>{item.canResume ? r.continueRun : r.view}</Link>}</div>)}</div>}
        <div className="space-y-3"><h2 className="font-semibold">{r.planItems}</h2>{run.planItems.map(item => <div key={item.id} className="flex flex-col gap-3 rounded-xl border bg-surface-1 p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.title}</p><span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(item.state)}`}>{r.states[item.state]}</span><span className="rounded-full border bg-surface-2 px-2 py-1 text-xs text-text-muted">{r.itemKinds[item.kind]}</span></div>{item.executor && <p className="mt-2 text-xs text-text-muted">{r.user}: {item.executor}{item.startedAt ? ` · ${r.duration}: ${durationText(item.durationMs ?? (clock - Date.parse(item.startedAt)))}` : ""}</p>}</div>{item.childRunId ? <Link className={buttonClass} href={`/runs/${item.childRunId}`}>{item.state === "in_progress" && item.canResume ? r.resume : r.view}</Link> : run.canEdit && item.state === "not_started" ? <button className={buttonClass} disabled={aggregateBusy || conflict} onClick={() => {
          const storageKey = `run-item-start:${item.id}`; const key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID(); sessionStorage.setItem(storageKey, key); void (async () => {
            const result = await aggregateMutation(`/items/${item.id}/start`, {}, "POST", key);
            if (result.ok && result.runId) { sessionStorage.removeItem(storageKey); router.push(`/runs/${result.runId}`); }
          })();
        }}>{r.start}</button> : null}</div>)}</div>
      </section>}

      {(run.canEdit || run.canOverride) && <section className="space-y-4 rounded-xl border bg-surface-1 p-5 shadow-soft">
        {run.canEdit && <label className="flex gap-2"><input type="checkbox" checked={manual} disabled={aggregateBusy} onChange={event => setManual(event.target.checked)} />{r.override}</label>}
        {(manual || run.canOverride) && <div className="space-y-3"><label>{r.final}<select className={inputClass} value={finalStatus} disabled={aggregateBusy} onChange={event => setFinalStatus(event.target.value as Result)}>{(["passed", "failed", "questionable"] as const).map(value => <option key={value} value={value}>{r.states[value]}</option>)}</select></label><label className="block">{r.reason}<textarea className={inputClass} maxLength={5000} disabled={aggregateBusy} value={reason} onChange={event => setReason(event.target.value)} /></label></div>}
        {run.canEdit ? <><button className={primaryClass} disabled={aggregateBusy || conflict || !canComplete || (manual && !reason.trim())} onClick={() => void completeMutation(manual ? { override: { finalStatus, reason } } : {})}>{aggregateBusy ? r.saving : r.complete}</button>{!canComplete && <p className="text-sm text-text-muted">{r.incomplete}</p>}<label className="block">{r.cancelledReason}<textarea className={inputClass} maxLength={5000} disabled={aggregateBusy} value={cancelReason} onChange={event => setCancelReason(event.target.value)} /></label><button className={buttonClass} disabled={aggregateBusy || conflict || !cancelReason.trim()} onClick={() => void cancelMutation()}>{r.cancel}</button></> : <button className={buttonClass} disabled={aggregateBusy || conflict || !reason.trim()} onClick={() => void aggregateMutation("/overrides", { finalStatus, reason })}>{r.applyOverride}</button>}
      </section>}
      {run.planContext && run.lifecycle === "completed" && <section className="space-y-4 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5 shadow-soft"><div><h2 className="text-lg font-semibold">{r.childCompleted}</h2><p className="mt-1 text-sm text-text-muted">{r.result}: {run.finalStatus ? r.states[run.finalStatus] : r.unknown}</p></div>{run.planContext.allProcessed && <p className="text-sm text-emerald-400">{r.allPlanItemsProcessed}</p>}<div className="flex flex-wrap gap-3">{run.planContext.nextActionable ? <><button className={primaryClass} disabled={nextBusy} onClick={() => void openNextPlanItem()}>{nextBusy ? r.loading : r.completeAndNext}</button><button className={buttonClass} onClick={() => void navigateSafely(`/runs/${run.planContext!.planRunId}`)}>{r.returnToPlan}</button></> : <button className={primaryClass} onClick={() => void navigateSafely(`/runs/${run.planContext!.planRunId}`)}>{r.returnToPlan}</button>}</div>{nextError && <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400"><p>{r.nextOpenFailed}</p><p>{runErrorLabel(nextError, r)}</p></div>}</section>}
      {run.overrides.length > 0 && <section className="space-y-3 rounded-xl border p-5"><h2 className="font-semibold">{r.audit}</h2>{run.overrides.map(event => <div key={event.id} className="border-t pt-3"><p>{date(event.overriddenAt)} · {event.overriddenByEmailSnapshot}</p><p>{r.auto}: {r.states[event.autoStatus]} · {r.previous}: {r.states[event.previousFinalStatus]} → {r.final}: {r.states[event.finalStatus]}</p><p className="whitespace-pre-wrap">{event.reason}</p></div>)}</section>}
    </>}
  </div>;
}
