import type { PrismaClient } from "@prisma/client";

const MAX_INCLUDE_DEPTH = 12;

export type StoredStepRow =
  | {
      kind?: "step";
      step?: string;
      expectedResult?: string;
      actualResult?: string;
    }
  | {
      kind: "include";
      testCaseId: string;
    };

export type FlattenedStepRow = {
  step: string;
  expectedResult: string;
  /** Template field on the source step row (optional) */
  actualResult?: string;
  /** Test case that owns this step text (after resolving includes) */
  sourceTestCaseId: string;
  sourceTestCaseTitle: string;
};

function normalizeRows(raw: unknown): StoredStepRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    if (row && typeof row === "object" && (row as { kind?: string }).kind === "include") {
      const id = typeof (row as { testCaseId?: string }).testCaseId === "string" ? (row as { testCaseId: string }).testCaseId : "";
      return { kind: "include" as const, testCaseId: id };
    }
    const r = row as { step?: string; expectedResult?: string; actualResult?: string };
    return {
      kind: "step" as const,
      step: typeof r.step === "string" ? r.step : "",
      expectedResult: typeof r.expectedResult === "string" ? r.expectedResult : "",
      actualResult: typeof r.actualResult === "string" ? r.actualResult : ""
    };
  });
}

/**
 * Expands "include" rows by inlining steps from referenced test cases (same project only).
 */
export async function flattenTestCaseSteps(
  prisma: PrismaClient,
  rootTestCaseId: string,
  projectId: string
): Promise<{ steps: FlattenedStepRow[]; error: string | null }> {
  const path = new Set<string>();

  async function walk(tcId: string, depth: number): Promise<{ steps: FlattenedStepRow[]; error: string | null }> {
    if (depth > MAX_INCLUDE_DEPTH) {
      return { steps: [], error: "includeDepthExceeded" };
    }
    if (path.has(tcId)) {
      return { steps: [], error: "includeCycle" };
    }
    path.add(tcId);

    const tc = await prisma.testCase.findUnique({ where: { id: tcId } });
    if (!tc || tc.projectId !== projectId) {
      path.delete(tcId);
      return { steps: [], error: "includeNotFound" };
    }

    const rows = normalizeRows(tc.stepsJson);
    const out: FlattenedStepRow[] = [];

    for (const row of rows) {
      if ("kind" in row && row.kind === "include") {
        if (!row.testCaseId?.trim()) continue;
        if (row.testCaseId === tcId) {
          path.delete(tcId);
          return { steps: [], error: "includeSelf" };
        }
        const sub = await walk(row.testCaseId, depth + 1);
        if (sub.error) {
          path.delete(tcId);
          return sub;
        }
        out.push(...sub.steps);
      } else {
        const r = row as { step?: string; expectedResult?: string; actualResult?: string };
        out.push({
          step: r.step ?? "",
          expectedResult: r.expectedResult ?? "",
          actualResult: typeof r.actualResult === "string" ? r.actualResult : undefined,
          sourceTestCaseId: tc.id,
          sourceTestCaseTitle: tc.title
        });
      }
    }

    path.delete(tcId);
    return { steps: out, error: null };
  }

  return walk(rootTestCaseId, 0);
}

/**
 * Same as flatten, but uses `overrideRootSteps` for `rootTestCaseId` instead of DB (for validation before save).
 */
export async function flattenTestCaseStepsWithOverride(
  prisma: PrismaClient,
  rootTestCaseId: string,
  projectId: string,
  overrideRootSteps: StoredStepRow[]
): Promise<{ steps: FlattenedStepRow[]; error: string | null }> {
  const path = new Set<string>();

  async function walk(tcId: string, depth: number, useOverride: StoredStepRow[] | null): Promise<{ steps: FlattenedStepRow[]; error: string | null }> {
    if (depth > MAX_INCLUDE_DEPTH) {
      return { steps: [], error: "includeDepthExceeded" };
    }
    if (path.has(tcId)) {
      return { steps: [], error: "includeCycle" };
    }
    path.add(tcId);

    const tc = await prisma.testCase.findUnique({ where: { id: tcId } });
    if (!tc || tc.projectId !== projectId) {
      path.delete(tcId);
      return { steps: [], error: "includeNotFound" };
    }

    const rows = useOverride !== null ? useOverride : normalizeRows(tc.stepsJson);
    const out: FlattenedStepRow[] = [];

    for (const row of rows) {
      if ("kind" in row && row.kind === "include") {
        if (!row.testCaseId?.trim()) continue;
        if (row.testCaseId === tcId) {
          path.delete(tcId);
          return { steps: [], error: "includeSelf" };
        }
        const sub = await walk(row.testCaseId, depth + 1, null);
        if (sub.error) {
          path.delete(tcId);
          return sub;
        }
        out.push(...sub.steps);
      } else {
        const r = row as { step?: string; expectedResult?: string; actualResult?: string };
        out.push({
          step: r.step ?? "",
          expectedResult: r.expectedResult ?? "",
          actualResult: typeof r.actualResult === "string" ? r.actualResult : undefined,
          sourceTestCaseId: tc.id,
          sourceTestCaseTitle: tc.title
        });
      }
    }

    path.delete(tcId);
    return { steps: out, error: null };
  }

  return walk(rootTestCaseId, 0, overrideRootSteps);
}

export async function validateStepsForSave(
  prisma: PrismaClient,
  projectId: string,
  rootId: string,
  incomingRows: StoredStepRow[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const refIds = new Set<string>();
  for (const r of incomingRows) {
    if ("kind" in r && r.kind === "include" && r.testCaseId?.trim()) {
      if (r.testCaseId === rootId) return { ok: false, error: "includeSelf" };
      refIds.add(r.testCaseId);
    }
  }
  if (refIds.size > 0) {
    const found = await prisma.testCase.findMany({
      where: { id: { in: [...refIds] }, projectId }
    });
    if (found.length !== refIds.size) return { ok: false, error: "includeNotFound" };
  }
  const flat = await flattenTestCaseStepsWithOverride(prisma, rootId, projectId, incomingRows);
  if (flat.error) return { ok: false, error: flat.error };
  if (flat.steps.length === 0) {
    return { ok: false, error: "emptySteps" };
  }
  return { ok: true };
}

/** For POST: root row does not exist in DB yet — only include rows hit the database. */
export async function flattenForNewTestCase(
  prisma: PrismaClient,
  projectId: string,
  rows: StoredStepRow[]
): Promise<{ steps: FlattenedStepRow[]; error: string | null }> {
  const path = new Set<string>();

  async function walkFromDb(tcId: string, depth: number): Promise<{ steps: FlattenedStepRow[]; error: string | null }> {
    if (depth > MAX_INCLUDE_DEPTH) {
      return { steps: [], error: "includeDepthExceeded" };
    }
    if (path.has(tcId)) {
      return { steps: [], error: "includeCycle" };
    }
    path.add(tcId);

    const tc = await prisma.testCase.findUnique({ where: { id: tcId } });
    if (!tc || tc.projectId !== projectId) {
      path.delete(tcId);
      return { steps: [], error: "includeNotFound" };
    }

    const inner = normalizeRows(tc.stepsJson);
    const out: FlattenedStepRow[] = [];

    for (const row of inner) {
      if ("kind" in row && row.kind === "include") {
        if (!row.testCaseId?.trim()) continue;
        if (row.testCaseId === tcId) {
          path.delete(tcId);
          return { steps: [], error: "includeSelf" };
        }
        const sub = await walkFromDb(row.testCaseId, depth + 1);
        if (sub.error) {
          path.delete(tcId);
          return sub;
        }
        out.push(...sub.steps);
      } else {
        const r = row as { step?: string; expectedResult?: string; actualResult?: string };
        out.push({
          step: r.step ?? "",
          expectedResult: r.expectedResult ?? "",
          actualResult: typeof r.actualResult === "string" ? r.actualResult : undefined,
          sourceTestCaseId: tc.id,
          sourceTestCaseTitle: tc.title
        });
      }
    }

    path.delete(tcId);
    return { steps: out, error: null };
  }

  const out: FlattenedStepRow[] = [];
  for (const row of rows) {
    if ("kind" in row && row.kind === "include") {
      if (!row.testCaseId?.trim()) continue;
      const sub = await walkFromDb(row.testCaseId, 0);
      if (sub.error) return sub;
      out.push(...sub.steps);
    } else {
      const r = row as { step?: string; expectedResult?: string; actualResult?: string };
      out.push({
        step: r.step ?? "",
        expectedResult: r.expectedResult ?? "",
        actualResult: typeof r.actualResult === "string" ? r.actualResult : undefined,
        sourceTestCaseId: "",
        sourceTestCaseTitle: ""
      });
    }
  }
  return { steps: out, error: null };
}

export async function validateStepsForCreate(
  prisma: PrismaClient,
  projectId: string,
  rows: StoredStepRow[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const refIds = new Set<string>();
  for (const r of rows) {
    if ("kind" in r && r.kind === "include" && r.testCaseId?.trim()) {
      refIds.add(r.testCaseId);
    }
  }
  if (refIds.size > 0) {
    const found = await prisma.testCase.findMany({
      where: { id: { in: [...refIds] }, projectId }
    });
    if (found.length !== refIds.size) return { ok: false, error: "includeNotFound" };
  }
  const flat = await flattenForNewTestCase(prisma, projectId, rows);
  if (flat.error) return { ok: false, error: flat.error };
  if (flat.steps.length === 0) return { ok: false, error: "emptySteps" };
  return { ok: true };
}

/** True if structure has at least one plain step or a valid include reference (non-empty id). */
export function storedStepsAreNonEmpty(rows: StoredStepRow[]): boolean {
  for (const row of rows) {
    if ("kind" in row && row.kind === "include" && row.testCaseId?.trim()) return true;
    if (!("kind" in row) || row.kind !== "include") {
      const s = row as { step?: string };
      if ((s.step ?? "").trim()) return true;
    }
  }
  return false;
}

export function parseStoredSteps(raw: unknown): StoredStepRow[] {
  return normalizeRows(raw);
}
