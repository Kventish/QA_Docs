-- Add attachmentsJson to run tables
ALTER TABLE "TestCaseRun" ADD COLUMN "attachmentsJson" JSON NOT NULL DEFAULT '[]';
ALTER TABLE "ChecklistRun" ADD COLUMN "attachmentsJson" JSON NOT NULL DEFAULT '[]';
ALTER TABLE "TestPlanRun" ADD COLUMN "attachmentsJson" JSON NOT NULL DEFAULT '[]';
