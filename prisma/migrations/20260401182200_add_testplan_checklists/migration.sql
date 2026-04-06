-- CreateTable
CREATE TABLE "TestPlanChecklist" (
    "testPlanId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestPlanChecklist_pkey" PRIMARY KEY ("testPlanId", "checklistId")
);

-- CreateIndex
CREATE INDEX "TestPlanChecklist_checklistId_idx" ON "TestPlanChecklist"("checklistId");

-- AddForeignKey
ALTER TABLE "TestPlanChecklist" ADD CONSTRAINT "TestPlanChecklist_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "TestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPlanChecklist" ADD CONSTRAINT "TestPlanChecklist_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
