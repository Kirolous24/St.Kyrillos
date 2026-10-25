-- Fellowship meetings (2026-10-24): the Women's, Men's and Youth meetings.
-- Additive only. A meeting is a SchoolClass with stage FELLOWSHIP; a member who
-- does not serve has a MEMBER account that never signs in; members check in by
-- tapping their name on a MEMBER_CHECKIN code, one person per phone per code.
-- The new enum values are not used in this migration, so ADD VALUE is safe in
-- Prisma's transaction on Postgres 12+.

-- AlterEnum
ALTER TYPE "PortalRole" ADD VALUE 'MEMBER';

-- AlterEnum
ALTER TYPE "QrTokenKind" ADD VALUE 'MEMBER_CHECKIN';

-- AlterEnum
ALTER TYPE "Stage" ADD VALUE 'FELLOWSHIP';

-- AlterTable
ALTER TABLE "QrRedemption" ADD COLUMN     "device" TEXT;

-- CreateIndex
CREATE INDEX "QrRedemption_tokenId_device_idx" ON "QrRedemption"("tokenId", "device");

