-- Follow-up groups (2026-09-26): every child belongs to one of their class's
-- servants, and a contact can be logged on any child, not only inside a case.
--
-- Hand-edited from `prisma migrate diff`: the generated SQL added
-- "FollowUpLog"."studentId" as NOT NULL straight away, which fails on the
-- contact logs that already exist. It is added nullable, filled from each
-- log's case (every existing log belongs to one), and only then made required.

-- Groups: the servant who follows a child up. Resolved against the class's
-- active servants when read, so nothing here depends on ClassServant rows.
ALTER TABLE "Student" ADD COLUMN "groupServantId" TEXT;
ALTER TABLE "Student" ADD COLUMN "groupAssignedAt" TIMESTAMP(3);
CREATE INDEX "Student_groupServantId_idx" ON "Student"("groupServantId");
ALTER TABLE "Student" ADD CONSTRAINT "Student_groupServantId_fkey" FOREIGN KEY ("groupServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Set once a class has been split; the automatic first split runs only while null.
ALTER TABLE "SchoolClass" ADD COLUMN "groupsSplitAt" TIMESTAMP(3);

-- Check-ins: a contact log names its child directly; the case becomes optional.
ALTER TABLE "FollowUpLog" ADD COLUMN "studentId" TEXT;
UPDATE "FollowUpLog" l SET "studentId" = c."studentId" FROM "FollowUpCase" c WHERE l."caseId" = c."id";
ALTER TABLE "FollowUpLog" ALTER COLUMN "studentId" SET NOT NULL;
ALTER TABLE "FollowUpLog" ALTER COLUMN "caseId" DROP NOT NULL;
CREATE INDEX "FollowUpLog_studentId_at_idx" ON "FollowUpLog"("studentId", "at" DESC);
ALTER TABLE "FollowUpLog" ADD CONSTRAINT "FollowUpLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
