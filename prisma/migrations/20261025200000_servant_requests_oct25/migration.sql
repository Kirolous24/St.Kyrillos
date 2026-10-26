-- CreateEnum
CREATE TYPE "FamilyContact" AS ENUM ('MOTHER', 'FATHER', 'STUDENT');

-- AlterTable
ALTER TABLE "SchoolClass" ADD COLUMN     "attendancePartnerId" TEXT,
ADD COLUMN     "groupsShuffleDueOn" DATE,
ADD COLUMN     "groupsShuffledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "callFirst" "FamilyContact";

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_attendancePartnerId_fkey" FOREIGN KEY ("attendancePartnerId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Data (2026-10-25). Follow-up groups are shuffled every two months, the first
-- time one month from now ("start now with 1 month from here"). Fellowship
-- meetings never shuffle.
UPDATE "SchoolClass"
SET "groupsShuffleDueOn" = (CURRENT_DATE + INTERVAL '1 month')::date
WHERE "stage" <> 'FELLOWSHIP';

-- The boys' and girls' classes of 5th & 6th and of 7th & 8th take each other's
-- registers, and nothing else of each other (stored both ways; only where both
-- classes exist).
UPDATE "SchoolClass" AS c
SET "attendancePartnerId" = p.partner
FROM (VALUES
  ('5th-6th-boys', '5th-6th-girls'),
  ('5th-6th-girls', '5th-6th-boys'),
  ('7th-8th-boys', '7th-8th-girls'),
  ('7th-8th-girls', '7th-8th-boys')
) AS p(id, partner)
WHERE c."id" = p.id
  AND EXISTS (SELECT 1 FROM "SchoolClass" o WHERE o."id" = p.partner);
