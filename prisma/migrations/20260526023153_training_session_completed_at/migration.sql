-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "TrainingSession_completedAt_idx" ON "TrainingSession"("completedAt");
