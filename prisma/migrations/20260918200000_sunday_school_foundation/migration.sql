-- CreateEnum
CREATE TYPE "PortalRole" AS ENUM ('STUDENT', 'SERVANT', 'ADMIN', 'PASTOR');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL');

-- CreateEnum
CREATE TYPE "ClassTitle" AS ENUM ('COORDINATOR', 'ASSISTANT_COORDINATOR');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'EXCUSED', 'ABSENT');

-- CreateEnum
CREATE TYPE "PointSource" AS ENUM ('ATTENDANCE', 'MANUAL', 'QUIZ', 'UNDO', 'QR');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "CaseOrigin" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" "PortalRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "photo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "legacyUid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "visitationThreshold" INTEGER NOT NULL DEFAULT 2,
    "curriculumLinkedToId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "classId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT,
    "dob" DATE,
    "grade" TEXT,
    "address" TEXT,
    "fatherName" TEXT,
    "fatherPhone" TEXT,
    "motherName" TEXT,
    "motherPhone" TEXT,
    "parentEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "importNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servant" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "birthday" DATE,
    "address" TEXT,
    "stageOversight" "Stage",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassServant" (
    "classId" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "title" "ClassTitle",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClassServant_pkey" PRIMARY KEY ("classId","servantId")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "markedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointActivity" (
    "id" TEXT NOT NULL,
    "classId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "points" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointEntry" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT,
    "points" INTEGER NOT NULL,
    "source" "PointSource" NOT NULL,
    "activityKey" TEXT,
    "activityLabel" TEXT NOT NULL,
    "reason" TEXT,
    "attendanceRecordId" TEXT,
    "undoOfId" TEXT,
    "undone" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpCase" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "origin" "CaseOrigin" NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "consecutiveAbsences" INTEGER NOT NULL DEFAULT 0,
    "lastSeen" DATE,
    "nextFollowUp" DATE,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolveReason" TEXT,
    "resolveNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpLog" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT,
    "result" TEXT,
    "byId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServantActivity" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServantActivity_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ServantAttendance" (
    "id" TEXT NOT NULL,
    "servantId" TEXT NOT NULL,
    "activityKey" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "reason" TEXT,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServantAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_loginId_key" ON "Account"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_legacyUid_key" ON "Account"("legacyUid");

-- CreateIndex
CREATE INDEX "Account_role_idx" ON "Account"("role");

-- CreateIndex
CREATE INDEX "SchoolClass_stage_idx" ON "SchoolClass"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "Student_accountId_key" ON "Student"("accountId");

-- CreateIndex
CREATE INDEX "Student_classId_idx" ON "Student"("classId");

-- CreateIndex
CREATE INDEX "Student_lastName_firstName_idx" ON "Student"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Servant_accountId_key" ON "Servant"("accountId");

-- CreateIndex
CREATE INDEX "ClassServant_servantId_idx" ON "ClassServant"("servantId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_classId_date_sessionKey_idx" ON "AttendanceRecord"("classId", "date", "sessionKey");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_sessionKey_date_idx" ON "AttendanceRecord"("studentId", "sessionKey", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_date_sessionKey_key" ON "AttendanceRecord"("studentId", "date", "sessionKey");

-- CreateIndex
CREATE UNIQUE INDEX "PointActivity_classId_key_key" ON "PointActivity"("classId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PointEntry_attendanceRecordId_key" ON "PointEntry"("attendanceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "PointEntry_undoOfId_key" ON "PointEntry"("undoOfId");

-- CreateIndex
CREATE INDEX "PointEntry_studentId_createdAt_idx" ON "PointEntry"("studentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PointEntry_classId_createdAt_idx" ON "PointEntry"("classId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FollowUpCase_classId_status_idx" ON "FollowUpCase"("classId", "status");

-- CreateIndex
CREATE INDEX "FollowUpCase_studentId_status_idx" ON "FollowUpCase"("studentId", "status");

-- CreateIndex
CREATE INDEX "FollowUpLog_caseId_at_idx" ON "FollowUpLog"("caseId", "at" DESC);

-- CreateIndex
CREATE INDEX "ServantAttendance_weekStart_idx" ON "ServantAttendance"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "ServantAttendance_servantId_activityKey_weekStart_key" ON "ServantAttendance"("servantId", "activityKey", "weekStart");

-- CreateIndex
CREATE INDEX "PortalAuditLog_createdAt_idx" ON "PortalAuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "PortalAuditLog_entity_entityId_idx" ON "PortalAuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEvent_date_sortOrder_title_key" ON "ScheduleEvent"("date", "sortOrder", "title");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servant" ADD CONSTRAINT "Servant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassServant" ADD CONSTRAINT "ClassServant_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassServant" ADD CONSTRAINT "ClassServant_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointActivity" ADD CONSTRAINT "PointActivity_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointActivity" ADD CONSTRAINT "PointActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_undoOfId_fkey" FOREIGN KEY ("undoOfId") REFERENCES "PointEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEntry" ADD CONSTRAINT "PointEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpCase" ADD CONSTRAINT "FollowUpCase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpCase" ADD CONSTRAINT "FollowUpCase_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpCase" ADD CONSTRAINT "FollowUpCase_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpCase" ADD CONSTRAINT "FollowUpCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpLog" ADD CONSTRAINT "FollowUpLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FollowUpCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpLog" ADD CONSTRAINT "FollowUpLog_byId_fkey" FOREIGN KEY ("byId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantAttendance" ADD CONSTRAINT "ServantAttendance_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServantAttendance" ADD CONSTRAINT "ServantAttendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAuditLog" ADD CONSTRAINT "PortalAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

