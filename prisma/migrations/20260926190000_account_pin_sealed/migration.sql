-- Option B (2026-09-26): an encrypted copy of a PIN the portal issued, so an
-- admin can look it up. Sign-in never reads it. Nullable with no backfill:
-- existing PINs are recovered by the admin's one-time Recover PINs upload.
ALTER TABLE "Account" ADD COLUMN "pinSealed" TEXT;
