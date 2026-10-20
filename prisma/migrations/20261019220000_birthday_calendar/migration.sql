-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "calendarToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Account_calendarToken_key" ON "Account"("calendarToken");

