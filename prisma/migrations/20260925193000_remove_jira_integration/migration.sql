-- Remove the retired Jira integration fields without affecting other data.
ALTER TABLE "Project"
DROP COLUMN "jiraEpicKey",
DROP COLUMN "jiraProjectKey";

ALTER TABLE "TestCase"
DROP COLUMN "jiraIssueKey";

ALTER TABLE "Checklist"
DROP COLUMN "jiraIssueKey";

ALTER TABLE "TestPlan"
DROP COLUMN "jiraIssueKey";

ALTER TABLE "TestCaseRun"
DROP COLUMN "jiraIssueKey";

ALTER TABLE "ChecklistRun"
DROP COLUMN "jiraIssueKey";

ALTER TABLE "TestPlanRun"
DROP COLUMN "jiraIssueKey";
