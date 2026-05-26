/*
  Warnings:

  - You are about to drop the `BowSetup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Skill` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SkillEvaluation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SkillScore` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CompetitionType" AS ENUM ('INDOOR_18M', 'OUTDOOR_70M', 'OUTDOOR_50M', 'FIELD', 'CLOUT', 'THREE_D', 'OTHER');

-- DropForeignKey
ALTER TABLE "BowSetup" DROP CONSTRAINT "BowSetup_athleteId_fkey";

-- DropForeignKey
ALTER TABLE "SkillEvaluation" DROP CONSTRAINT "SkillEvaluation_coachId_fkey";

-- DropForeignKey
ALTER TABLE "SkillEvaluation" DROP CONSTRAINT "SkillEvaluation_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "SkillScore" DROP CONSTRAINT "SkillScore_evaluationId_fkey";

-- DropForeignKey
ALTER TABLE "SkillScore" DROP CONSTRAINT "SkillScore_skillId_fkey";

-- DropTable
DROP TABLE "BowSetup";

-- DropTable
DROP TABLE "Skill";

-- DropTable
DROP TABLE "SkillEvaluation";

-- DropTable
DROP TABLE "SkillScore";

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CompetitionType" NOT NULL,
    "location" TEXT,
    "totalScore" INTEGER NOT NULL,
    "rank" INTEGER,
    "xCount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competition_athleteId_date_idx" ON "Competition"("athleteId", "date");

-- CreateIndex
CREATE INDEX "Competition_date_idx" ON "Competition"("date");

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
