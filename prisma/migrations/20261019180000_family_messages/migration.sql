-- AlterTable
ALTER TABLE "FollowUpLog" ADD COLUMN     "missedOn" DATE,
ADD COLUMN     "missedSessionKey" TEXT;

-- CreateTable
CREATE TABLE "MeetingMessage" (
    "classId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingMessage_pkey" PRIMARY KEY ("classId","sessionKey")
);

-- AddForeignKey
ALTER TABLE "MeetingMessage" ADD CONSTRAINT "MeetingMessage_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingMessage" ADD CONSTRAINT "MeetingMessage_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

