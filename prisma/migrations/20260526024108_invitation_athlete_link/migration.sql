-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "athleteId" TEXT;

-- CreateIndex
CREATE INDEX "Invitation_athleteId_idx" ON "Invitation"("athleteId");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
