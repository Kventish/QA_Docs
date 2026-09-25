import { createHash, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { DefinitionSnapshot, Kind, RunError, SnapshotStep, leafSteps } from "./domain";

type Tx = Prisma.TransactionClient;
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RunError("invalidDefinition");
  return value as Record<string, unknown>;
};
const string = (value: unknown) => typeof value === "string" ? value : "";

// All reads use the Start transaction's repeatable snapshot, never a later current definition.
export async function captureDefinition(tx: Tx, kind: Kind, id: string, projectId: string): Promise<DefinitionSnapshot> {
  const row = kind === "test_case" ? await tx.testCase.findUnique({ where: { id } })
    : kind === "checklist" ? await tx.checklist.findUnique({ where: { id } })
    : await tx.testPlan.findUnique({ where: { id } });
  if (!row || row.projectId !== projectId) throw new RunError("notFound", 404);
  if (row.status === "archived") throw new RunError("archived");
  const base: DefinitionSnapshot = {
    schemaVersion: 1, kind, documentId: id, projectId, sourceUpdatedAt: row.updatedAt.toISOString(),
    title: row.title, description: "description" in row ? row.description : "",
    preconditions: "preconditions" in row ? row.preconditions : "",
    postconditions: "postconditions" in row ? row.postconditions : "",
    expected: "expected" in row ? row.expected : "", objective: "objective" in row ? row.objective : "",
    scope: "scope" in row ? row.scope : "", tags: row.tags, steps: [], items: []
  };
  const cases = new Map<string, Awaited<ReturnType<typeof tx.testCase.findUnique>>>();
  let nodeCount = 0;
  async function rows(
    raw: unknown,
    source: { id: string; title: string; updatedAt: Date },
    includePath: string[],
    level = 1,
    sourcePosition: number[] = []
  ): Promise<SnapshotStep[]> {
    if (!Array.isArray(raw)) throw new RunError("invalidDefinition");
    const output: SnapshotStep[] = [];
    for (const [index, value] of raw.entries()) {
      if (++nodeCount > 2000) throw new RunError("definitionTooLarge");
      const r = record(value);
      if (r.kind === "include") {
        const ref = string(r.testCaseId);
        if (!ref || includePath.includes(ref) || includePath.length >= 12) throw new RunError("invalidInclude");
        if (!cases.has(ref)) cases.set(ref, await tx.testCase.findUnique({ where: { id: ref } }));
        const included = cases.get(ref);
        if (!included || included.projectId !== projectId) throw new RunError("invalidInclude");
        output.push(...await rows(included.stepsJson, included, [...includePath, ref], level));
        continue;
      }
      const childrenRaw = r.substeps ?? r.children ?? [];
      if (!Array.isArray(childrenRaw)) throw new RunError("invalidDefinition");
      if (childrenRaw.length && level >= 2) throw new RunError("invalidDefinition");
      const currentPosition = [...sourcePosition, index];
      const sourceKey = string(r.stableKey) || createHash("sha256")
        .update(`${source.id}:${source.updatedAt.toISOString()}:${currentPosition.join(".")}`)
        .digest("hex");
      const step: SnapshotStep = {
        key: randomUUID(), sourceKey, sourceDocumentId: source.id, sourceTitle: source.title,
        sourceUpdatedAt: source.updatedAt.toISOString(), includePath,
        action: string(r.step ?? r.text), expected: string(r.expectedResult),
        children: await rows(childrenRaw, source, includePath, level + 1, currentPosition)
      };
      if (!step.action.trim()) throw new RunError("invalidDefinition");
      output.push(step);
    }
    return output;
  }
  if (kind === "test_plan") {
    const plan = await tx.testPlan.findUniqueOrThrow({ where: { id }, include: {
      cases: { orderBy: [{ order: "asc" }, { testCaseId: "asc" }] },
      checklists: { orderBy: [{ order: "asc" }, { checklistId: "asc" }] }
    } });
    if (plan.cases.length + plan.checklists.length > 100) throw new RunError("definitionTooLarge");
    for (const c of plan.cases) base.items.push({ key: randomUUID(), definition: await captureDefinition(tx, "test_case", c.testCaseId, projectId) });
    for (const c of plan.checklists) base.items.push({ key: randomUUID(), definition: await captureDefinition(tx, "checklist", c.checklistId, projectId) });
    if (!base.items.length) throw new RunError("emptyDefinition");
  } else {
    base.steps = await rows("stepsJson" in row ? row.stepsJson : "itemsJson" in row ? row.itemsJson : [], row, [id]);
    if (!leafSteps(base.steps).length) throw new RunError("emptyDefinition");
  }
  if (Buffer.byteLength(JSON.stringify(base)) > 2_000_000) throw new RunError("definitionTooLarge");
  return base;
}

export async function storeSnapshot(tx: Tx, definition: DefinitionSnapshot) {
  return tx.runDefinitionSnapshot.create({ data: {
    definition: definition as unknown as Prisma.InputJsonObject,
    contentHash: createHash("sha256").update(JSON.stringify(definition)).digest("hex")
  } });
}
