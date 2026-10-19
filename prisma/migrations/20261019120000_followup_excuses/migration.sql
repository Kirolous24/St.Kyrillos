-- AlterTable
ALTER TABLE "FollowUpLog" ADD COLUMN     "groupServantId" TEXT;

-- CreateTable
CREATE TABLE "FollowUpExcuse" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpExcuse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUpExcuse_studentId_endsOn_idx" ON "FollowUpExcuse"("studentId", "endsOn");

-- AddForeignKey
ALTER TABLE "FollowUpLog" ADD CONSTRAINT "FollowUpLog_groupServantId_fkey" FOREIGN KEY ("groupServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpExcuse" ADD CONSTRAINT "FollowUpExcuse_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpExcuse" ADD CONSTRAINT "FollowUpExcuse_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpExcuse" ADD CONSTRAINT "FollowUpExcuse_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

