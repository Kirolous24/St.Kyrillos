-- Points are the same in every class (2026-09-27). Data only; no schema change.

-- 1. Every activity a class made for itself becomes part of the one church-wide
--    list, worth 2. Points already given keep the value they were given at.
UPDATE "PointActivity" SET "classId" = NULL, "points" = 2 WHERE "classId" IS NOT NULL;

-- 2. The session values the church chose: Liturgy 5, Sunday School 3, the rest 2.
--    Attendance already taken keeps its points; these apply from now on.
UPDATE "AttendanceSession" SET "points" = 5 WHERE "key" = 'liturgy';
UPDATE "AttendanceSession" SET "points" = 3 WHERE "key" = 'sunday';
UPDATE "AttendanceSession" SET "points" = 2 WHERE "key" IN ('vespers', 'tasbeha', 'bible', 'hymns');
