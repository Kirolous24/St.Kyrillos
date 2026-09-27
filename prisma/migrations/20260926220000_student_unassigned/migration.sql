-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "unassignedAt" TIMESTAMP(3),
ADD COLUMN     "unassignedById" TEXT,
ADD COLUMN     "unassignedFromClassId" TEXT,
ADD COLUMN     "unassignedReason" TEXT;

-- CreateIndex
CREATE INDEX "Student_unassignedAt_idx" ON "Student"("unassignedAt");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_unassignedById_fkey" FOREIGN KEY ("unassignedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
