export type Result = "passed" | "failed" | "questionable";
export type ExecutionSeverity = "low" | "medium" | "high" | "critical";
export type Kind = "test_case" | "checklist" | "test_plan";
export type Lifecycle = "in_progress" | "completed" | "cancelled";

export class RunError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

export type SnapshotStep = {
  key: string;
  sourceKey: string;
  sourceDocumentId: string;
  sourceTitle: string;
  sourceUpdatedAt: string;
  includePath: string[];
  action: string;
  expected: string;
  children: SnapshotStep[];
};

export type DefinitionSnapshot = {
  schemaVersion: 1;
  kind: Kind;
  documentId: string;
  projectId: string;
  sourceUpdatedAt: string;
  title: string;
  description: string;
  preconditions: string;
  postconditions: string;
  expected: string;
  objective: string;
  scope: string;
  tags: string[];
  steps: SnapshotStep[];
  items: { key: string; definition: DefinitionSnapshot }[];
};

export function leafSteps(steps: SnapshotStep[]): SnapshotStep[] {
  return steps.flatMap(step => step.children.length ? leafSteps(step.children) : [step]);
}

export function calculateStatus(results: (Result | null)[]): Result | null {
  if (results.includes("failed")) return "failed";
  if (results.includes("questionable")) return "questionable";
  return results.length > 0 && results.every(result => result === "passed") ? "passed" : null;
}

export function executionSeverity(result: Result | null, severity: ExecutionSeverity | null): ExecutionSeverity | null {
  if (result === "passed" || result === null) return null;
  if (result === "failed" && severity === null) throw new RunError("severityRequired");
  return severity;
}

export function planItemState(item: { cancelledAt: unknown; childRun: { lifecycle: Lifecycle; finalStatus: Result | null } | null }): Result | "in_progress" | "not_started" | "cancelled" {
  if (item.childRun?.lifecycle === "completed") return item.childRun.finalStatus!;
  if (item.cancelledAt || item.childRun?.lifecycle === "cancelled") return "cancelled";
  return item.childRun ? "in_progress" : "not_started";
}

export const documentPaths: Record<Kind, string> = {
  test_case: "test-cases", checklist: "checklists", test_plan: "test-plans"
};

export function durationText(ms: number | null) {
  if (ms === null) return "—";
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
