-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('pending', 'running', 'passed', 'failed');

-- CreateTable
CREATE TABLE "TestCaseRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testCaseId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "actualResult" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "TestCaseRun_testCaseId_idx" ON "TestCaseRun"("testCaseId");
CREATE INDEX "TestCaseRun_status_idx" ON "TestCaseRun"("status");
CREATE INDEX "TestCaseRun_createdAt_idx" ON "TestCaseRun"("createdAt");

-- AddForeignKey
ALTER TABLE "TestCaseRun" ADD CONSTRAINT "TestCaseRun_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ChecklistRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checklistId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "itemResults" JSON NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ChecklistRun_checklistId_idx" ON "ChecklistRun"("checklistId");
CREATE INDEX "ChecklistRun_status_idx" ON "ChecklistRun"("status");
CREATE INDEX "ChecklistRun_createdAt_idx" ON "ChecklistRun"("createdAt");

-- AddForeignKey
ALTER TABLE "ChecklistRun" ADD CONSTRAINT "ChecklistRun_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TestPlanRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testPlanId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "summary" TEXT NOT NULL DEFAULT '',
    "detailsJson" JSON NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "TestPlanRun_testPlanId_idx" ON "TestPlanRun"("testPlanId");
CREATE INDEX "TestPlanRun_status_idx" ON "TestPlanRun"("status");
CREATE INDEX "TestPlanRun_createdAt_idx" ON "TestPlanRun"("createdAt");

-- AddForeignKey
ALTER TABLE "TestPlanRun" ADD CONSTRAINT "TestPlanRun_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "TestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
