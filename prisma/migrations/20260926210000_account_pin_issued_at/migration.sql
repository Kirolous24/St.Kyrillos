-- When the portal last issued an account's PIN. Send logins asks Resend who was
-- emailed their login; an email sent before this time carries an older PIN and
-- does not count. Nullable with no backfill: null means "before any email".
ALTER TABLE "Account" ADD COLUMN "pinIssuedAt" TIMESTAMP(3);
