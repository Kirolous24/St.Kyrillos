-- The church's rule changed: a follow-up case opens on the FIRST missed Sunday
-- School, not the second. The prototype defaulted to 2 and so did this port;
-- every fallback in the application code now says 1 as well.
ALTER TABLE "SchoolClass" ALTER COLUMN "visitationThreshold" SET DEFAULT 1;

-- Changing the default alone would do nothing for the classes that already
-- exist, which is all of them — so the ones still sitting on the old default
-- move with it. A class somebody deliberately set to something else is left
-- exactly as it is: KG is already on 1, and the admin screen allows up to 10.
UPDATE "SchoolClass" SET "visitationThreshold" = 1 WHERE "visitationThreshold" = 2;
