-- PHASE A: normalized Run Engine. This migration is additive and preserves all legacy run rows.

-- CreateEnum
CREATE TYPE "RunKind" AS ENUM ('test_case', 'checklist', 'test_plan');

-- CreateEnum
CREATE TYPE "RunLifecycle" AS ENUM ('in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('passed', 'failed', 'questionable');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- AlterTable: user records remain available for historical foreign keys and author snapshots.
ALTER TABLE "User"
ADD COLUMN "disabledAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Preserve legacy Run history if a document is removed. The existing rows and JSON are not transformed.
ALTER TABLE "TestCaseRun" DROP CONSTRAINT "TestCaseRun_testCaseId_fkey";
ALTER TABLE "ChecklistRun" DROP CONSTRAINT "ChecklistRun_checklistId_fkey";
ALTER TABLE "TestPlanRun" DROP CONSTRAINT "TestPlanRun_testPlanId_fkey";

ALTER TABLE "TestCaseRun"
ADD CONSTRAINT "TestCaseRun_testCaseId_fkey"
FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChecklistRun"
ADD CONSTRAINT "ChecklistRun_checklistId_fkey"
FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TestPlanRun"
ADD CONSTRAINT "TestPlanRun_testPlanId_fkey"
FOREIGN KEY ("testPlanId") REFERENCES "TestPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "RunDefinitionSnapshot" (
    "id" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "definition" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunDefinitionSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RunDefinitionSnapshot_schemaVersion_check" CHECK ("schemaVersion" > 0),
    CONSTRAINT "RunDefinitionSnapshot_contentHash_check" CHECK ("contentHash" ~ '^[0-9a-f]{64}$')
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "RunKind" NOT NULL,
    "testCaseId" TEXT,
    "checklistId" TEXT,
    "testPlanId" TEXT,
    "snapshotId" TEXT NOT NULL,
    "lifecycle" "RunLifecycle" NOT NULL DEFAULT 'in_progress',
    "autoStatus" "ResultStatus",
    "finalStatus" "ResultStatus",
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedById" TEXT NOT NULL,
    "startedByEmailSnapshot" TEXT NOT NULL,
    "startedByDisplayNameSnapshot" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledByEmailSnapshot" TEXT,
    "cancelledByDisplayNameSnapshot" TEXT,
    "cancelReason" TEXT,
    "durationMs" BIGINT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id"),

    -- Exactly one document relation must match Run.kind.
    CONSTRAINT "Run_kind_document_fkey_check" CHECK (
        ("kind" = 'test_case'::"RunKind" AND "testCaseId" IS NOT NULL AND "checklistId" IS NULL AND "testPlanId" IS NULL)
        OR
        ("kind" = 'checklist'::"RunKind" AND "testCaseId" IS NULL AND "checklistId" IS NOT NULL AND "testPlanId" IS NULL)
        OR
        ("kind" = 'test_plan'::"RunKind" AND "testCaseId" IS NULL AND "checklistId" IS NULL AND "testPlanId" IS NOT NULL)
    ),

    -- Lifecycle timestamps and final result cannot describe conflicting states.
    CONSTRAINT "Run_lifecycle_fields_check" CHECK (
        (
            "lifecycle" = 'in_progress'::"RunLifecycle"
            AND "completedAt" IS NULL
            AND "cancelledAt" IS NULL
            AND "cancelledById" IS NULL
            AND "cancelledByEmailSnapshot" IS NULL
            AND "cancelReason" IS NULL
            AND "durationMs" IS NULL
            AND "finalStatus" IS NULL
        )
        OR
        (
            "lifecycle" = 'completed'::"RunLifecycle"
            AND "completedAt" IS NOT NULL
            AND "cancelledAt" IS NULL
            AND "cancelledById" IS NULL
            AND "cancelledByEmailSnapshot" IS NULL
            AND "cancelReason" IS NULL
            AND "durationMs" IS NOT NULL
            AND "autoStatus" IS NOT NULL
            AND "finalStatus" IS NOT NULL
        )
        OR
        (
            "lifecycle" = 'cancelled'::"RunLifecycle"
            AND "completedAt" IS NULL
            AND "cancelledAt" IS NOT NULL
            AND "cancelledById" IS NOT NULL
            AND "cancelledByEmailSnapshot" IS NOT NULL
            AND "cancelReason" IS NOT NULL
            AND btrim("cancelReason") <> ''
            AND "durationMs" IS NOT NULL
            AND "finalStatus" IS NULL
        )
    ),
    CONSTRAINT "Run_completedAt_startedAt_check" CHECK ("completedAt" IS NULL OR "completedAt" >= "startedAt"),
    CONSTRAINT "Run_cancelledAt_startedAt_check" CHECK ("cancelledAt" IS NULL OR "cancelledAt" >= "startedAt"),
    CONSTRAINT "Run_duration_check" CHECK ("durationMs" IS NULL OR "durationMs" >= 0),
    CONSTRAINT "Run_revision_check" CHECK ("revision" >= 0),
    CONSTRAINT "Run_idempotencyKey_check" CHECK (char_length("idempotencyKey") BETWEEN 8 AND 100)
);

-- CreateTable
CREATE TABLE "StepRunResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "result" "ResultStatus",
    "severity" "Severity",
    "actualResult" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT,
    "updatedByEmailSnapshot" TEXT,
    "updatedByDisplayNameSnapshot" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StepRunResult_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StepRunResult_result_severity_check" CHECK (
        ("result" IS NULL AND "severity" IS NULL)
        OR ("result" = 'passed'::"ResultStatus" AND "severity" IS NULL)
        OR ("result" = 'failed'::"ResultStatus" AND "severity" IS NOT NULL)
        OR ("result" = 'questionable'::"ResultStatus")
    ),
    CONSTRAINT "StepRunResult_revision_check" CHECK ("revision" >= 0),
    CONSTRAINT "StepRunResult_updater_snapshot_check" CHECK (
        ("updatedById" IS NULL AND "updatedByEmailSnapshot" IS NULL)
        OR ("updatedById" IS NOT NULL AND "updatedByEmailSnapshot" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "StepRunComment" (
    "id" TEXT NOT NULL,
    "stepRunResultId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorEmailSnapshot" TEXT NOT NULL,
    "authorDisplayNameSnapshot" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StepRunComment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StepRunComment_body_check" CHECK (btrim("body") <> '')
);

-- CreateTable
CREATE TABLE "RunAttachment" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepRunResultId" TEXT,
    "pathname" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedByEmailSnapshot" TEXT NOT NULL,
    "uploadedByDisplayNameSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RunAttachment_size_check" CHECK ("size" > 0 AND "size" <= 3145728),
    CONSTRAINT "RunAttachment_pathname_check" CHECK ("pathname" LIKE 'runs/%')
);

-- CreateTable
CREATE TABLE "RunOverrideEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "autoStatus" "ResultStatus" NOT NULL,
    "previousFinalStatus" "ResultStatus" NOT NULL,
    "finalStatus" "ResultStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "overriddenById" TEXT NOT NULL,
    "overriddenByEmailSnapshot" TEXT NOT NULL,
    "overriddenByDisplayNameSnapshot" TEXT,
    "overriddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunOverrideEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RunOverrideEvent_reason_check" CHECK (btrim("reason") <> '')
);

-- CreateTable
CREATE TABLE "TestPlanRunItem" (
    "id" TEXT NOT NULL,
    "planRunId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "testCaseId" TEXT,
    "checklistId" TEXT,
    "snapshotId" TEXT NOT NULL,
    "childRunId" TEXT,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "TestPlanRunItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TestPlanRunItem_definition_xor_check" CHECK (
        ("testCaseId" IS NOT NULL AND "checklistId" IS NULL)
        OR ("testCaseId" IS NULL AND "checklistId" IS NOT NULL)
    ),
    CONSTRAINT "TestPlanRunItem_position_check" CHECK ("position" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "Run_snapshotId_key" ON "Run"("snapshotId");
CREATE UNIQUE INDEX "Run_startedById_idempotencyKey_key" ON "Run"("startedById", "idempotencyKey");
CREATE INDEX "Run_projectId_lifecycle_idx" ON "Run"("projectId", "lifecycle");
CREATE INDEX "Run_testCaseId_startedAt_id_idx" ON "Run"("testCaseId", "startedAt", "id");
CREATE INDEX "Run_checklistId_startedAt_id_idx" ON "Run"("checklistId", "startedAt", "id");
CREATE INDEX "Run_testPlanId_startedAt_id_idx" ON "Run"("testPlanId", "startedAt", "id");

CREATE UNIQUE INDEX "StepRunResult_runId_occurrenceKey_key" ON "StepRunResult"("runId", "occurrenceKey");
CREATE UNIQUE INDEX "StepRunResult_id_runId_key" ON "StepRunResult"("id", "runId");
CREATE INDEX "StepRunResult_runId_result_idx" ON "StepRunResult"("runId", "result");

CREATE INDEX "StepRunComment_stepRunResultId_createdAt_idx" ON "StepRunComment"("stepRunResultId", "createdAt");

CREATE UNIQUE INDEX "RunAttachment_pathname_key" ON "RunAttachment"("pathname");
CREATE INDEX "RunAttachment_runId_idx" ON "RunAttachment"("runId");
CREATE INDEX "RunAttachment_stepRunResultId_idx" ON "RunAttachment"("stepRunResultId");

CREATE INDEX "RunOverrideEvent_runId_overriddenAt_idx" ON "RunOverrideEvent"("runId", "overriddenAt");

CREATE UNIQUE INDEX "TestPlanRunItem_snapshotId_key" ON "TestPlanRunItem"("snapshotId");
CREATE UNIQUE INDEX "TestPlanRunItem_childRunId_key" ON "TestPlanRunItem"("childRunId");
CREATE UNIQUE INDEX "TestPlanRunItem_planRunId_position_key" ON "TestPlanRunItem"("planRunId", "position");

-- AddForeignKey: all historical relations use RESTRICT.
ALTER TABLE "Run"
ADD CONSTRAINT "Run_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Run"
ADD CONSTRAINT "Run_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Run"
ADD CONSTRAINT "Run_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Run"
ADD CONSTRAINT "Run_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "TestPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Run"
ADD CONSTRAINT "Run_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RunDefinitionSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Run"
ADD CONSTRAINT "Run_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Run"
ADD CONSTRAINT "Run_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StepRunResult"
ADD CONSTRAINT "StepRunResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StepRunResult"
ADD CONSTRAINT "StepRunResult_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StepRunComment"
ADD CONSTRAINT "StepRunComment_stepRunResultId_fkey" FOREIGN KEY ("stepRunResultId") REFERENCES "StepRunResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StepRunComment"
ADD CONSTRAINT "StepRunComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RunAttachment"
ADD CONSTRAINT "RunAttachment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- PostgreSQL's default MATCH SIMPLE skips this composite FK only when stepRunResultId is NULL.
-- When it is set, the pair guarantees that the step belongs to this attachment's Run.
ALTER TABLE "RunAttachment"
ADD CONSTRAINT "RunAttachment_stepRunResultId_runId_fkey"
FOREIGN KEY ("stepRunResultId", "runId") REFERENCES "StepRunResult"("id", "runId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RunAttachment"
ADD CONSTRAINT "RunAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RunOverrideEvent"
ADD CONSTRAINT "RunOverrideEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RunOverrideEvent"
ADD CONSTRAINT "RunOverrideEvent_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TestPlanRunItem"
ADD CONSTRAINT "TestPlanRunItem_planRunId_fkey" FOREIGN KEY ("planRunId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestPlanRunItem"
ADD CONSTRAINT "TestPlanRunItem_childRunId_fkey" FOREIGN KEY ("childRunId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestPlanRunItem"
ADD CONSTRAINT "TestPlanRunItem_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RunDefinitionSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestPlanRunItem"
ADD CONSTRAINT "TestPlanRunItem_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TestPlanRunItem"
ADD CONSTRAINT "TestPlanRunItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Snapshots are append-only after Start. Deletion remains controlled by RESTRICT foreign keys.
CREATE OR REPLACE FUNCTION "reject_run_definition_snapshot_update"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'RunDefinitionSnapshot is immutable';
END;
$$;

CREATE TRIGGER "RunDefinitionSnapshot_reject_update"
BEFORE UPDATE ON "RunDefinitionSnapshot"
FOR EACH ROW EXECUTE FUNCTION "reject_run_definition_snapshot_update"();
