-- CreateTable
CREATE TABLE "ScheduleEvent" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateDay" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "TemplateDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateDayEvent" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "location" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "TemplateDayEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopticDayCache" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "copticDate" TEXT,
    "season" TEXT,
    "seasonDay" TEXT,
    "isFasting" BOOLEAN NOT NULL DEFAULT false,
    "readings" JSONB,
    "synaxarium" JSONB,
    "feasts" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopticDayCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiturgicalEvent" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'coptic.io',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiturgicalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLastSeen" (
    "userName" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLastSeen_pkey" PRIMARY KEY ("userName")
);

-- CreateTable
CREATE TABLE "WeeklyService" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LivestreamStatus" (
    "id" TEXT NOT NULL DEFAULT 'current',
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "videoId" TEXT,
    "title" TEXT,
    "thumbnail" TEXT,
    "viewers" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subscribedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "lastSearchAt" TIMESTAMP(3),

    CONSTRAINT "LivestreamStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleEvent_date_idx" ON "ScheduleEvent"("date");

-- CreateIndex
CREATE INDEX "TemplateDay_templateId_idx" ON "TemplateDay"("templateId");

-- CreateIndex
CREATE INDEX "TemplateDayEvent_dayId_idx" ON "TemplateDayEvent"("dayId");

-- CreateIndex
CREATE UNIQUE INDEX "CopticDayCache_date_key" ON "CopticDayCache"("date");

-- CreateIndex
CREATE INDEX "CopticDayCache_date_idx" ON "CopticDayCache"("date");

-- CreateIndex
CREATE INDEX "LiturgicalEvent_date_idx" ON "LiturgicalEvent"("date");

-- CreateIndex
CREATE UNIQUE INDEX "LiturgicalEvent_date_title_key" ON "LiturgicalEvent"("date", "title");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityLog_userName_idx" ON "ActivityLog"("userName");

-- CreateIndex
CREATE INDEX "WeeklyService_dayOfWeek_idx" ON "WeeklyService"("dayOfWeek");

-- AddForeignKey
ALTER TABLE "TemplateDay" ADD CONSTRAINT "TemplateDay_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SeasonTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateDayEvent" ADD CONSTRAINT "TemplateDayEvent_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "TemplateDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

