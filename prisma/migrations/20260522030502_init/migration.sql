-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ATHLETE', 'COACH', 'CLUB_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('TECHNICAL', 'SERIES', 'COMPETITION_SIM', 'WARMUP');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'JUSTIFIED', 'LATE');

-- CreateEnum
CREATE TYPE "WeatherCondition" AS ENUM ('CALM', 'MODERATE', 'STRONG');

-- CreateEnum
CREATE TYPE "DominantHand" AS ENUM ('RIGHT', 'LEFT');

-- CreateTable
CREATE TABLE "BowModality" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BowModality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationTag" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ObservationTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clubId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clubId" TEXT NOT NULL,
    "coachId" TEXT,
    "bowModalityId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "dominantHand" "DominantHand" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionGroup" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "SessionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "sessionGroupId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "SessionType" NOT NULL,
    "indoor" BOOLEAN NOT NULL DEFAULT false,
    "weather" "WeatherCondition",
    "weatherNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreSet" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "distance" INTEGER NOT NULL,
    "endsCount" INTEGER NOT NULL,
    "arrowsPerEnd" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arrow" (
    "id" TEXT NOT NULL,
    "scoreSetId" TEXT NOT NULL,
    "endNumber" INTEGER NOT NULL,
    "arrowNumber" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "isX" BOOLEAN NOT NULL DEFAULT false,
    "isMiss" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Arrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "reason" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachObservation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editableUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ObservationTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BowModality_code_key" ON "BowModality"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ObservationTag_code_key" ON "ObservationTag"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clubId_idx" ON "User"("clubId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_userId_key" ON "Coach"("userId");

-- CreateIndex
CREATE INDEX "Coach_clubId_idx" ON "Coach"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_userId_key" ON "Athlete"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_documentId_key" ON "Athlete"("documentId");

-- CreateIndex
CREATE INDEX "Athlete_clubId_idx" ON "Athlete"("clubId");

-- CreateIndex
CREATE INDEX "Athlete_coachId_idx" ON "Athlete"("coachId");

-- CreateIndex
CREATE INDEX "Athlete_bowModalityId_idx" ON "Athlete"("bowModalityId");

-- CreateIndex
CREATE INDEX "Athlete_active_idx" ON "Athlete"("active");

-- CreateIndex
CREATE INDEX "SessionGroup_date_idx" ON "SessionGroup"("date");

-- CreateIndex
CREATE INDEX "SessionGroup_createdById_idx" ON "SessionGroup"("createdById");

-- CreateIndex
CREATE INDEX "TrainingSession_athleteId_date_idx" ON "TrainingSession"("athleteId", "date");

-- CreateIndex
CREATE INDEX "TrainingSession_date_idx" ON "TrainingSession"("date");

-- CreateIndex
CREATE INDEX "TrainingSession_sessionGroupId_idx" ON "TrainingSession"("sessionGroupId");

-- CreateIndex
CREATE INDEX "ScoreSet_sessionId_idx" ON "ScoreSet"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreSet_sessionId_distance_key" ON "ScoreSet"("sessionId", "distance");

-- CreateIndex
CREATE INDEX "Arrow_scoreSetId_idx" ON "Arrow"("scoreSetId");

-- CreateIndex
CREATE UNIQUE INDEX "Arrow_scoreSetId_endNumber_arrowNumber_key" ON "Arrow"("scoreSetId", "endNumber", "arrowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_key" ON "Attendance"("sessionId");

-- CreateIndex
CREATE INDEX "Attendance_athleteId_idx" ON "Attendance"("athleteId");

-- CreateIndex
CREATE INDEX "CoachObservation_sessionId_idx" ON "CoachObservation"("sessionId");

-- CreateIndex
CREATE INDEX "CoachObservation_coachId_idx" ON "CoachObservation"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "_ObservationTags_AB_unique" ON "_ObservationTags"("A", "B");

-- CreateIndex
CREATE INDEX "_ObservationTags_B_index" ON "_ObservationTags"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_bowModalityId_fkey" FOREIGN KEY ("bowModalityId") REFERENCES "BowModality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionGroup" ADD CONSTRAINT "SessionGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_sessionGroupId_fkey" FOREIGN KEY ("sessionGroupId") REFERENCES "SessionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreSet" ADD CONSTRAINT "ScoreSet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arrow" ADD CONSTRAINT "Arrow_scoreSetId_fkey" FOREIGN KEY ("scoreSetId") REFERENCES "ScoreSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachObservation" ADD CONSTRAINT "CoachObservation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachObservation" ADD CONSTRAINT "CoachObservation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ObservationTags" ADD CONSTRAINT "_ObservationTags_A_fkey" FOREIGN KEY ("A") REFERENCES "CoachObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ObservationTags" ADD CONSTRAINT "_ObservationTags_B_fkey" FOREIGN KEY ("B") REFERENCES "ObservationTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
