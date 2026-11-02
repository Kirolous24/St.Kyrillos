-- When the admin last reset a child's points to 0 (2026-11-02). Additive:
-- one nullable column.

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "pointsResetAt" TIMESTAMP(3);
