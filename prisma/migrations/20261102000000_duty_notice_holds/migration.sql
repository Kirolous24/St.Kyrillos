-- Parts given out more than a week ahead are announced a week before they are
-- due (2026-11-01). Additive: one new table.

-- CreateTable
CREATE TABLE "DutyNoticeHold" (
    "slot" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "due" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DutyNoticeHold_pkey" PRIMARY KEY ("slot","servantId")
);

-- CreateIndex
CREATE INDEX "DutyNoticeHold_due_idx" ON "DutyNoticeHold"("due");

-- AddForeignKey
ALTER TABLE "DutyNoticeHold" ADD CONSTRAINT "DutyNoticeHold_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
