-- Add stepsJson to TestCaseRun for step-level run details
ALTER TABLE "TestCaseRun" ADD COLUMN "stepsJson" JSON NOT NULL DEFAULT '[]';
