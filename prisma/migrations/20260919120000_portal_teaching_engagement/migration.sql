-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('PLANNED', 'TAUGHT');

-- CreateEnum
CREATE TYPE "FeedTag" AS ENUM ('LESSON', 'ANNOUNCEMENT', 'RESOURCE', 'EVENT');

-- CreateEnum
CREATE TYPE "ReactionKind" AS ENUM ('HEART', 'PRAY', 'LIKE');

-- CreateEnum
CREATE TYPE "QrTokenKind" AS ENUM ('STUDENT_ATTENDANCE', 'STUDENT_POINTS', 'SERVANT_MEETING');

-- AlterTable
ALTER TABLE "SchoolClass" ADD COLUMN     "photo" TEXT;

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "classId" TEXT,
    "stage" "Stage",
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "dueDate" DATE,
    "pointsPerQuestion" INTEGER NOT NULL DEFAULT 2,
    "bibleReading" TEXT,
    "readingMessage" TEXT,
    "status" "ExamStatus" NOT NULL DEFAULT 'PUBLISHED',
    "reopenedFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "options" TEXT[],
    "correctIndex" INTEGER NOT NULL,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizResult" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "chosenIndex" INTEGER,
    "isCorrect" BOOLEAN NOT NULL,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "links" JSONB,
    "status" "LessonStatus" NOT NULL DEFAULT 'PLANNED',
    "assignedToId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaWeek" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "slideLink" TEXT,
    "notes" TEXT,
    "leadServantId" TEXT,
    "backupServantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaItem" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "activityKey" TEXT NOT NULL,
    "topic" TEXT,
    "servantId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hymn" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lyrics" TEXT,
    "audioUrl" TEXT,
    "notes" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hymn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedPost" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "imageUrl" TEXT,
    "link" TEXT,
    "linkLabel" TEXT,
    "tag" "FeedTag" NOT NULL DEFAULT 'ANNOUNCEMENT',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" "ReactionKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "emoji" TEXT,
    "date" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "classId" TEXT,
    "stage" "Stage",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT,
    "location" TEXT,
    "link" TEXT,
    "notes" TEXT,
    "targetAll" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalEventClass" (
    "eventId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "PortalEventClass_pkey" PRIMARY KEY ("eventId","classId")
);

-- CreateTable
CREATE TABLE "BibleReadingLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BibleReadingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAchievement" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrToken" (
    "token" TEXT NOT NULL,
    "kind" "QrTokenKind" NOT NULL,
    "classIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sessionKey" TEXT,
    "activityKey" TEXT,
    "activityLabel" TEXT,
    "points" INTEGER,
    "date" DATE,
    "weekStart" DATE,
    "title" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrToken_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "QrRedemption" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRead" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Exam_classId_dueDate_idx" ON "Exam"("classId", "dueDate");

-- CreateIndex
CREATE INDEX "Exam_status_dueDate_idx" ON "Exam"("status", "dueDate");

-- CreateIndex
CREATE INDEX "ExamQuestion_examId_sortOrder_idx" ON "ExamQuestion"("examId", "sortOrder");

-- CreateIndex
CREATE INDEX "QuizResult_studentId_submittedAt_idx" ON "QuizResult"("studentId", "submittedAt" DESC);

-- CreateIndex
CREATE INDEX "QuizResult_classId_submittedAt_idx" ON "QuizResult"("classId", "submittedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "QuizResult_examId_studentId_key" ON "QuizResult"("examId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_resultId_questionId_key" ON "QuizAnswer"("resultId", "questionId");

-- CreateIndex
CREATE INDEX "Lesson_classId_date_idx" ON "Lesson"("classId", "date");

-- CreateIndex
CREATE INDEX "Lesson_assignedToId_idx" ON "Lesson"("assignedToId");

-- CreateIndex
CREATE INDEX "AgendaWeek_weekStart_idx" ON "AgendaWeek"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaWeek_classId_weekStart_key" ON "AgendaWeek"("classId", "weekStart");

-- CreateIndex
CREATE INDEX "AgendaItem_servantId_idx" ON "AgendaItem"("servantId");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaItem_weekId_activityKey_key" ON "AgendaItem"("weekId", "activityKey");

-- CreateIndex
CREATE INDEX "Hymn_title_idx" ON "Hymn"("title");

-- CreateIndex
CREATE INDEX "FeedPost_classId_pinned_createdAt_idx" ON "FeedPost"("classId", "pinned", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FeedReaction_postId_idx" ON "FeedReaction"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedReaction_postId_accountId_kind_key" ON "FeedReaction"("postId", "accountId", "kind");

-- CreateIndex
CREATE INDEX "Announcement_classId_date_idx" ON "Announcement"("classId", "date" DESC);

-- CreateIndex
CREATE INDEX "Announcement_isActive_date_idx" ON "Announcement"("isActive", "date" DESC);

-- CreateIndex
CREATE INDEX "PortalEvent_date_idx" ON "PortalEvent"("date");

-- CreateIndex
CREATE INDEX "PortalEventClass_classId_idx" ON "PortalEventClass"("classId");

-- CreateIndex
CREATE INDEX "BibleReadingLog_date_idx" ON "BibleReadingLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BibleReadingLog_studentId_date_key" ON "BibleReadingLog"("studentId", "date");

-- CreateIndex
CREATE INDEX "StudentAchievement_studentId_idx" ON "StudentAchievement"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAchievement_studentId_badgeKey_key" ON "StudentAchievement"("studentId", "badgeKey");

-- CreateIndex
CREATE INDEX "QrToken_expiresAt_idx" ON "QrToken"("expiresAt");

-- CreateIndex
CREATE INDEX "QrRedemption_tokenId_idx" ON "QrRedemption"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "QrRedemption_tokenId_accountId_key" ON "QrRedemption"("tokenId", "accountId");

-- CreateIndex
CREATE INDEX "NotificationRead_accountId_idx" ON "NotificationRead"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRead_accountId_key_key" ON "NotificationRead"("accountId", "key");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResult" ADD CONSTRAINT "QuizResult_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "QuizResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaWeek" ADD CONSTRAINT "AgendaWeek_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaWeek" ADD CONSTRAINT "AgendaWeek_leadServantId_fkey" FOREIGN KEY ("leadServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaWeek" ADD CONSTRAINT "AgendaWeek_backupServantId_fkey" FOREIGN KEY ("backupServantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "AgendaWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_servantId_fkey" FOREIGN KEY ("servantId") REFERENCES "Servant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hymn" ADD CONSTRAINT "Hymn_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPost" ADD CONSTRAINT "FeedPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedReaction" ADD CONSTRAINT "FeedReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedReaction" ADD CONSTRAINT "FeedReaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalEvent" ADD CONSTRAINT "PortalEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalEventClass" ADD CONSTRAINT "PortalEventClass_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PortalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalEventClass" ADD CONSTRAINT "PortalEventClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BibleReadingLog" ADD CONSTRAINT "BibleReadingLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrToken" ADD CONSTRAINT "QrToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrRedemption" ADD CONSTRAINT "QrRedemption_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "QrToken"("token") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrRedemption" ADD CONSTRAINT "QrRedemption_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

