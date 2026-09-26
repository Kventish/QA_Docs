import { Prisma, Run, RunKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/auth";
import { calculateStatus, DefinitionSnapshot, executionSeverity, Kind, leafSteps, planItemState, Result, RunError, ExecutionSeverity, StepResult } from "./domain";
import { captureDefinition, storeSnapshot } from "./snapshot";

type DbClient = Pick<Prisma.TransactionClient,
  "user" | "userProjectAccess" | "run" | "testCase" | "checklist" | "testPlan">;
type Tx = Prisma.TransactionClient;
const transactionOptions = { maxWait: 5000, timeout: 20000 };
const documentWhere = (kind: Kind, id: string) => kind === "test_case" ? { testCaseId: id } : kind === "checklist" ? { checklistId: id } : { testPlanId: id };
export { documentWhere };

export async function currentActor(db: DbClient, session: SessionUser): Promise<SessionUser> {
  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user || user.disabledAt || user.deletedAt) throw new RunError("unauthorized", 401);
  return { id: user.id, email: user.email, role: user.role };
}

export async function projectAccess(db: DbClient, actor: SessionUser, projectId: string) {
  if (actor.role === "viewer" && !await db.userProjectAccess.findUnique({ where: { userId_projectId: { userId: actor.id, projectId } } })) {
    throw new RunError("forbidden", 403);
  }
}

export async function documentAccess(kind: Kind, id: string, session: SessionUser, db: DbClient = prisma) {
  const actor = await currentActor(db, session);
  const document = kind === "test_case" ? await db.testCase.findUnique({ where: { id } })
    : kind === "checklist" ? await db.checklist.findUnique({ where: { id } })
    : await db.testPlan.findUnique({ where: { id } });
  if (!document) throw new RunError("notFound", 404);
  await projectAccess(db, actor, document.projectId);
  return document;
}

export async function runAccess(db: DbClient, id: string, session: SessionUser, write = false) {
  const actor = await currentActor(db, session);
  const run = await db.run.findUnique({ where: { id } });
  if (!run) throw new RunError("notFound", 404);
  await projectAccess(db, actor, run.projectId);
  if (write && (actor.role === "viewer" || (actor.role !== "admin" && run.startedById !== actor.id))) throw new RunError("forbidden", 403);
  return { run, actor };
}

async function createRun(tx: Tx, definition: DefinitionSnapshot, snapshotId: string, actor: SessionUser, key: string) {
  return tx.run.create({ data: {
    kind: definition.kind, projectId: definition.projectId, ...documentWhere(definition.kind, definition.documentId),
    snapshotId, startedById: actor.id, startedByEmailSnapshot: actor.email, idempotencyKey: key,
    steps: { create: leafSteps(definition.steps).map(step => ({ occurrenceKey: step.key })) }
  } });
}

function matchesStart(run: Run, kind: Kind, documentId: string) {
  return run.kind === kind && (run.testCaseId ?? run.checklistId ?? run.testPlanId) === documentId;
}

export async function startRun(kind: Kind, documentId: string, key: string, session: SessionUser) {
  try {
    return await prisma.$transaction(async tx => {
      const actor = await currentActor(tx, session);
      if (actor.role === "viewer") throw new RunError("forbidden", 403);
      const existing = await tx.run.findUnique({ where: { startedById_idempotencyKey: { startedById: actor.id, idempotencyKey: key } }, include: { planItem: true } });
      if (existing) {
        if (!matchesStart(existing, kind, documentId) || existing.planItem) throw new RunError("idempotencyConflict", 409);
        await projectAccess(tx, actor, existing.projectId);
        return existing.id;
      }
      const document = await documentAccess(kind, documentId, actor, tx);
      const definition = await captureDefinition(tx, kind, documentId, document.projectId);
      const snapshot = await storeSnapshot(tx, definition);
      const run = await createRun(tx, definition, snapshot.id, actor, key);
      for (const [position, item] of definition.items.entries()) {
        const childSnapshot = await storeSnapshot(tx, item.definition);
        await tx.testPlanRunItem.create({ data: {
          id: item.key, planRunId: run.id, position, snapshotId: childSnapshot.id,
          ...(item.definition.kind === "test_case" ? { testCaseId: item.definition.documentId } : { checklistId: item.definition.documentId })
        } });
      }
      return run.id;
    }, { ...transactionOptions, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      const existing = await prisma.run.findUnique({ where: { startedById_idempotencyKey: { startedById: session.id, idempotencyKey: key } }, include: { planItem: true } });
      if (existing && matchesStart(existing, kind, documentId) && !existing.planItem) {
        await runAccess(prisma, existing.id, session);
        return existing.id;
      }
      throw new RunError("conflict", 409);
    }
    throw error;
  }
}

// Every child mutation locks the parent first. Parent cancel/complete cannot race it.
async function lockMutation(tx: Tx, id: string, revision: number, session: SessionUser, completed = false) {
  const parentItem = await tx.testPlanRunItem.findUnique({ where: { childRunId: id } });
  if (parentItem) {
    await tx.$queryRaw`SELECT id FROM "Run" WHERE id = ${parentItem.planRunId} FOR UPDATE`;
    const parent = await tx.run.findUniqueOrThrow({ where: { id: parentItem.planRunId } });
    if (parent.lifecycle !== "in_progress") throw new RunError("closed", 409);
  }
  await tx.$queryRaw`SELECT id FROM "Run" WHERE id = ${id} FOR UPDATE`;
  const { run, actor } = await runAccess(tx, id, session, true);
  if (run.revision !== revision) throw new RunError("conflict", 409);
  if (run.lifecycle !== (completed ? "completed" : "in_progress")) throw new RunError("closed", 409);
  await tx.run.update({ where: { id }, data: { revision: { increment: 1 } } });
  return { run, actor, parentItem };
}

async function recalculate(tx: Tx, run: Run) {
  const results = run.kind === "test_plan"
    ? (await tx.testPlanRunItem.findMany({ where: { planRunId: run.id }, include: { childRun: true } })).map(item => {
      const child = item.childRun;
      return child?.lifecycle === "completed" ? child.finalStatus
        : child?.lifecycle === "in_progress" && child.autoStatus !== "passed" ? child.autoStatus : null;
    })
    : (await tx.stepRunResult.findMany({ where: { runId: run.id }, select: { result: true } })).map(step => step.result);
  const autoStatus = calculateStatus(results);
  await tx.run.update({ where: { id: run.id }, data: { autoStatus } });
  return autoStatus;
}

export async function mutateRun<T>(id: string, revision: number, session: SessionUser,
  operation: (tx: Tx, run: Run, actor: SessionUser) => Promise<T>, completed = false) {
  return prisma.$transaction(async tx => {
    const { run, actor, parentItem } = await lockMutation(tx, id, revision, session, completed);
    const result = await operation(tx, run, actor);
    if (parentItem) {
      const parent = await tx.run.update({ where: { id: parentItem.planRunId }, data: { revision: { increment: 1 } } });
      await recalculate(tx, parent);
    }
    return result;
  }, transactionOptions);
}

// Step content has its own revision. Locking the Run keeps Complete/Cancel from
// racing a save, but ordinary step edits do not consume the global Run revision.
async function lockOpenStepMutation(tx: Tx, id: string, session: SessionUser) {
  const parentItem = await tx.testPlanRunItem.findUnique({ where: { childRunId: id } });
  if (parentItem) {
    await tx.$queryRaw`SELECT id FROM "Run" WHERE id = ${parentItem.planRunId} FOR UPDATE`;
    const parent = await tx.run.findUniqueOrThrow({ where: { id: parentItem.planRunId } });
    if (parent.lifecycle !== "in_progress") throw new RunError("closed", 409);
  }
  await tx.$queryRaw`SELECT id FROM "Run" WHERE id = ${id} FOR UPDATE`;
  const { run, actor } = await runAccess(tx, id, session, true);
  if (run.lifecycle !== "in_progress") throw new RunError("closed", 409);
  return { run, actor, parentItem };
}

export async function updateStep(id: string, stepId: string, session: SessionUser,
  patch: { stepRevision: number; result: StepResult | null; severity: ExecutionSeverity | null; actualResult: string }) {
  return prisma.$transaction(async tx => {
    const { run, actor, parentItem } = await lockOpenStepMutation(tx, id, session);
    const severity = executionSeverity(patch.result, patch.severity);
    const changed = await tx.stepRunResult.updateMany({
      where: { id: stepId, runId: id, revision: patch.stepRevision },
      data: { result: patch.result, severity, actualResult: patch.actualResult, updatedById: actor.id,
        updatedByEmailSnapshot: actor.email, revision: { increment: 1 } }
    });
    if (!changed.count) throw new RunError("conflict", 409);
    const autoStatus = await recalculate(tx, run);
    if (parentItem) {
      const parent = await tx.run.findUniqueOrThrow({ where: { id: parentItem.planRunId } });
      await recalculate(tx, parent);
    }
    const step = await tx.stepRunResult.findUniqueOrThrow({ where: { id: stepId } });
    return { step, autoStatus };
  }, transactionOptions);
}

export async function blockRemainingSteps(id: string, stepId: string, revision: number, session: SessionUser) {
  return mutateRun(id, revision, session, async (tx, run, actor) => {
    if (run.kind === "test_plan") throw new RunError("notFound", 404);
    const source = await tx.stepRunResult.findFirst({ where: { id: stepId, runId: id } });
    if (!source) throw new RunError("notFound", 404);
    if (source.result !== "failed") throw new RunError("sourceStepNotFailed", 409);

    const snapshot = await tx.runDefinitionSnapshot.findUniqueOrThrow({ where: { id: run.snapshotId } });
    const definition = snapshot.definition as unknown as DefinitionSnapshot;
    const orderedKeys = leafSteps(definition.steps).map(step => step.key);
    const sourceIndex = orderedKeys.indexOf(source.occurrenceKey);
    if (sourceIndex < 0) throw new RunError("invalidDefinition", 409);
    const remainingKeys = orderedKeys.slice(sourceIndex + 1);

    const changed = remainingKeys.length ? await tx.stepRunResult.updateMany({
      where: { runId: id, occurrenceKey: { in: remainingKeys }, result: null },
      data: {
        result: "blocked", severity: null, updatedById: actor.id,
        updatedByEmailSnapshot: actor.email, revision: { increment: 1 }
      }
    }) : { count: 0 };
    const autoStatus = await recalculate(tx, run);
    return { count: changed.count, autoStatus };
  });
}

export async function addComment(id: string, stepId: string, body: string, session: SessionUser) {
  return prisma.$transaction(async tx => {
    const { actor } = await lockOpenStepMutation(tx, id, session);
    if (!await tx.stepRunResult.findFirst({ where: { id: stepId, runId: id } })) throw new RunError("notFound", 404);
    return tx.stepRunComment.create({ data: { stepRunResultId: stepId, authorId: actor.id, authorEmailSnapshot: actor.email, body } });
  }, transactionOptions);
}

async function auditOverride(tx: Tx, run: Run, autoStatus: Result, previous: Result, finalStatus: Result, reason: string, actor: SessionUser) {
  if (!reason.trim()) throw new RunError("reasonRequired");
  await tx.runOverrideEvent.create({ data: {
    runId: run.id, autoStatus, previousFinalStatus: previous, finalStatus, reason: reason.trim(),
    overriddenById: actor.id, overriddenByEmailSnapshot: actor.email
  } });
}

// Before the first completion finalStatus is null, so the calculated status is the
// result the user is overriding. Later corrections use the persisted final status.
function previousFinalStatusForOverride(run: Pick<Run, "finalStatus">, autoStatus: Result): Result {
  return run.finalStatus ?? autoStatus;
}

export async function completeRun(id: string, revision: number, session: SessionUser, override?: { finalStatus: Result; reason: string }) {
  return mutateRun(id, revision, session, async (tx, run, actor) => {
    if (run.kind === "test_plan") {
      const items = await tx.testPlanRunItem.findMany({ where: { planRunId: id }, include: { childRun: true } });
      if (!items.length || items.some(item => item.childRun?.lifecycle !== "completed")) throw new RunError("incomplete");
    } else {
      const steps = await tx.stepRunResult.findMany({ where: { runId: id } });
      if (!steps.length || steps.some(step => !step.result)) throw new RunError("incomplete");
      steps.forEach(step => executionSeverity(step.result, step.severity));
    }
    const autoStatus = await recalculate(tx, run);
    if (!autoStatus) throw new RunError("incomplete");
    if (override) await auditOverride(tx, run, autoStatus,
      previousFinalStatusForOverride(run, autoStatus), override.finalStatus, override.reason, actor);
    const now = new Date();
    await tx.run.update({ where: { id }, data: {
      lifecycle: "completed", finalStatus: override?.finalStatus ?? autoStatus,
      completedAt: now, durationMs: BigInt(Math.max(0, now.getTime() - run.startedAt.getTime()))
    } });
  });
}

export async function overrideRun(id: string, revision: number, finalStatus: Result, reason: string, session: SessionUser) {
  return mutateRun(id, revision, session, async (tx, run, actor) => {
    if (actor.role !== "admin") throw new RunError("forbidden", 403);
    if (!run.autoStatus || !run.finalStatus) throw new RunError("incomplete");
    await auditOverride(tx, run, run.autoStatus,
      previousFinalStatusForOverride(run, run.autoStatus), finalStatus, reason, actor);
    await tx.run.update({ where: { id }, data: { finalStatus } });
  }, true);
}

export async function cancelRun(id: string, revision: number, reason: string, session: SessionUser) {
  return mutateRun(id, revision, session, async (tx, run, actor) => {
    const now = new Date();
    const data = { lifecycle: "cancelled" as const, finalStatus: null, cancelledAt: now, cancelledById: actor.id,
      cancelledByEmailSnapshot: actor.email, cancelReason: reason };
    if (run.kind === "test_plan") {
      const items = await tx.testPlanRunItem.findMany({ where: { planRunId: id }, include: { childRun: true } });
      for (const item of items) {
        if (!item.childRun) await tx.testPlanRunItem.update({ where: { id: item.id }, data: { cancelledAt: now } });
        else if (item.childRun.lifecycle === "in_progress") await tx.run.update({ where: { id: item.childRun.id }, data: {
          ...data, revision: { increment: 1 }, durationMs: BigInt(Math.max(0, now.getTime() - item.childRun.startedAt.getTime()))
        } });
      }
      await recalculate(tx, run);
    }
    await tx.run.update({ where: { id }, data: { ...data, durationMs: BigInt(Math.max(0, now.getTime() - run.startedAt.getTime())) } });
  });
}

export async function startPlanItem(id: string, itemId: string, revision: number, key: string, session: SessionUser) {
  // A lost successful response may be retried even with its original parent revision.
  const prior = await prisma.testPlanRunItem.findFirst({ where: { id: itemId, planRunId: id }, include: { childRun: true } });
  if (prior?.childRun?.lifecycle === "in_progress") {
    await runAccess(prisma, prior.childRun.id, session);
    return prior.childRun.id;
  }
  if (prior?.childRun?.startedById === session.id && prior.childRun.idempotencyKey === key) {
    await runAccess(prisma, prior.childRun.id, session);
    return prior.childRun.id;
  }
  return mutateRun(id, revision, session, async (tx, run, actor) => {
    if (run.kind !== "test_plan") throw new RunError("notFound", 404);
    const item = await tx.testPlanRunItem.findFirst({ where: { id: itemId, planRunId: id }, include: { snapshot: true } });
    if (!item) throw new RunError("notFound", 404);
    if (item.cancelledAt || item.childRunId) throw new RunError("conflict", 409);
    const child = await createRun(tx, item.snapshot.definition as unknown as DefinitionSnapshot, item.snapshotId, actor, key);
    await tx.testPlanRunItem.update({ where: { id: itemId }, data: { childRunId: child.id } });
    return child.id;
  });
}

export async function getRun(id: string, session: SessionUser) {
  // This is a UI read model; it does not require an interactive transaction.
  const { actor } = await runAccess(prisma, id, session);
  const run = await prisma.run.findUniqueOrThrow({ where: { id }, include: {
      snapshot: true,
      attachments: { where: { stepRunResultId: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, originalName: true, contentType: true, size: true, uploadedByEmailSnapshot: true, createdAt: true } },
      steps: { include: { comments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        attachments: { select: { id: true, originalName: true, contentType: true, size: true, uploadedByEmailSnapshot: true, createdAt: true } } } },
      overrides: { orderBy: [{ overriddenAt: "asc" }, { id: "asc" }] },
      planItem: { include: { planRun: { include: {
        snapshot: true,
        planItems: { orderBy: { position: "asc" }, include: {
          snapshot: true,
          childRun: { select: { id: true, lifecycle: true, finalStatus: true } }
        } }
      } } } },
      planItems: { orderBy: { position: "asc" }, include: {
        snapshot: true, childRun: { select: {
          id: true, lifecycle: true, finalStatus: true, autoStatus: true, startedById: true,
          startedByEmailSnapshot: true, startedAt: true, durationMs: true
        } }
      } }
    } });
    const parentOpen = !run.planItem || run.planItem.planRun.lifecycle === "in_progress";
    const canEdit = parentOpen && run.lifecycle === "in_progress" && actor.role !== "viewer" && (actor.role === "admin" || run.startedById === actor.id);
    let planContext = null;
    if (run.planItem) {
      const parent = run.planItem.planRun;
      const items = parent.planItems.map(item => ({
        id: item.id,
        position: item.position,
        title: (item.snapshot.definition as unknown as DefinitionSnapshot).title,
        kind: item.testCaseId ? "test_case" as const : "checklist" as const,
        childRunId: item.childRunId,
        state: planItemState(item)
      }));
      const currentIndex = items.findIndex(item => item.id === run.planItem!.id);
      const searchOrder = currentIndex < 0 ? items : [...items.slice(currentIndex + 1), ...items.slice(0, currentIndex)];
      const nextActionable = searchOrder.find(item => item.state === "in_progress" || item.state === "not_started") ?? null;
      planContext = {
        planRunId: parent.id,
        planRevision: parent.revision,
        planTitle: (parent.snapshot.definition as unknown as DefinitionSnapshot).title,
        itemId: run.planItem.id,
        position: currentIndex >= 0 ? currentIndex + 1 : run.planItem.position + 1,
        total: items.length,
        itemKind: run.kind,
        previousItem: currentIndex > 0 ? items[currentIndex - 1] : null,
        nextActionable,
        allProcessed: items.every(item => item.state === "passed" || item.state === "failed" || item.state === "questionable" || item.state === "cancelled")
      };
    }
  return {
      ...run, durationMs: run.durationMs === null ? null : Number(run.durationMs),
      definition: run.snapshot.definition as unknown as DefinitionSnapshot,
      canEdit, canOverride: parentOpen && actor.role === "admin" && run.lifecycle === "completed",
      parentRunId: run.planItem?.planRunId ?? null,
      planContext,
      planItems: run.planItems.map(item => ({
        id: item.id, position: item.position, childRunId: item.childRunId,
        title: (item.snapshot.definition as unknown as DefinitionSnapshot).title,
        kind: item.testCaseId ? "test_case" as const : "checklist" as const,
        state: planItemState(item),
        canResume: Boolean(item.childRun && (actor.role === "admin" || item.childRun.startedById === actor.id)),
        executor: item.childRun?.startedByEmailSnapshot ?? null,
        startedAt: item.childRun?.startedAt.toISOString() ?? null,
        durationMs: item.childRun?.durationMs === null || item.childRun?.durationMs === undefined ? null : Number(item.childRun.durationMs)
      })),
      snapshot: undefined, planItem: undefined, serverNow: new Date().toISOString()
  };
}

export type RunView = Awaited<ReturnType<typeof getRun>>;
// JSON transport converts Dates, but never exposes Blob pathname or authentication tokens.
export type RunViewJson = Omit<RunView, "startedAt" | "completedAt" | "cancelledAt" | "createdAt" | "updatedAt" | "steps" | "attachments" | "overrides"> & {
  startedAt: string; completedAt: string | null; cancelledAt: string | null; createdAt: string; updatedAt: string;
  attachments: (Omit<RunView["attachments"][number], "createdAt"> & { createdAt: string })[];
  steps: (Omit<RunView["steps"][number], "updatedAt" | "comments" | "attachments"> & {
    updatedAt: string;
    comments: (Omit<RunView["steps"][number]["comments"][number], "createdAt"> & { createdAt: string })[];
    attachments: (Omit<RunView["steps"][number]["attachments"][number], "createdAt"> & { createdAt: string })[];
  })[];
  overrides: (Omit<RunView["overrides"][number], "overriddenAt"> & { overriddenAt: string })[];
};
