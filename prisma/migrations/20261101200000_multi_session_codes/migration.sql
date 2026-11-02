-- AlterTable
ALTER TABLE "QrToken" ADD COLUMN     "activityKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sessionKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];

