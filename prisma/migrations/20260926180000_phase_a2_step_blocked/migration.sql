-- PHASE A.2: separate executable step outcomes from Run-level results.
-- Existing passed/failed/questionable values are preserved by the explicit text cast.

CREATE TYPE "StepResultStatus" AS ENUM ('passed', 'failed', 'questionable', 'blocked');

ALTER TABLE "StepRunResult"
DROP CONSTRAINT "StepRunResult_result_severity_check";

ALTER TABLE "StepRunResult"
ALTER COLUMN "result" TYPE "StepResultStatus"
USING ("result"::text::"StepResultStatus");

ALTER TABLE "StepRunResult"
ADD CONSTRAINT "StepRunResult_result_severity_check" CHECK (
    ("result" IS NULL AND "severity" IS NULL)
    OR ("result" = 'passed'::"StepResultStatus" AND "severity" IS NULL)
    OR ("result" = 'failed'::"StepResultStatus" AND "severity" IS NOT NULL)
    OR ("result" = 'questionable'::"StepResultStatus")
    OR ("result" = 'blocked'::"StepResultStatus" AND "severity" IS NULL)
);
