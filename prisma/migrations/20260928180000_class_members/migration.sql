-- AlterTable
ALTER TABLE "SchoolClass" ADD COLUMN     "takesOtherClasses" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN     "classId" TEXT;

-- CreateTable
CREATE TABLE "ClassMember" (
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT,

    CONSTRAINT "ClassMember_pkey" PRIMARY KEY ("classId","studentId")
);

-- CreateIndex
CREATE INDEX "ClassMember_studentId_idx" ON "ClassMember"("studentId");

-- CreateIndex
CREATE INDEX "AttendanceSession_classId_idx" ON "AttendanceSession"("classId");

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

