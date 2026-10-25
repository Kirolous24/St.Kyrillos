-- AlterTable
ALTER TABLE "AgendaItem" ADD COLUMN     "doneAt" TIMESTAMP(3),
ADD COLUMN     "doneById" TEXT;

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

