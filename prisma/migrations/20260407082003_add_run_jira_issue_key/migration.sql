-- AlterTable
ALTER TABLE "ChecklistRun" ADD COLUMN     "jiraIssueKey" TEXT;

-- AlterTable
ALTER TABLE "TestCaseRun" ADD COLUMN     "jiraIssueKey" TEXT;

-- AlterTable
ALTER TABLE "TestPlanRun" ADD COLUMN     "jiraIssueKey" TEXT;
