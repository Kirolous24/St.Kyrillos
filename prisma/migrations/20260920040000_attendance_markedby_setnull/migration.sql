-- DropForeignKey
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_markedById_fkey";

-- AlterTable
ALTER TABLE "AttendanceRecord" ALTER COLUMN "markedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

