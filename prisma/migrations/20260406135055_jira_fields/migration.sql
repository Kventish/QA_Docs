-- AlterTable
ALTER TABLE "Checklist" ADD COLUMN     "jiraIssueKey" TEXT;

-- AlterTable
ALTER TABLE "ChecklistRun" ALTER COLUMN "itemResults" SET DATA TYPE JSONB,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "attachmentsJson" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "jiraEpicKey" TEXT,
ADD COLUMN     "jiraProjectKey" TEXT;

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "jiraIssueKey" TEXT;

-- AlterTable
ALTER TABLE "TestCaseRun" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "attachmentsJson" SET DATA TYPE JSONB,
ALTER COLUMN "stepsJson" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "TestPlan" ADD COLUMN     "jiraIssueKey" TEXT;

-- AlterTable
ALTER TABLE "TestPlanRun" ALTER COLUMN "detailsJson" SET DATA TYPE JSONB,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "attachmentsJson" SET DATA TYPE JSONB;
