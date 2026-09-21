-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('LOSE_WEIGHT', 'BUILD_MUSCLE', 'GET_STRONGER', 'IMPROVE_CONDITION', 'GET_FIT');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "TrainingLocation" AS ENUM ('HOME', 'GYM', 'BOTH');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('NONE', 'DUMBBELLS', 'RESISTANCE_BANDS', 'KETTLEBELL', 'FULL_GYM');

-- CreateEnum
CREATE TYPE "SessionDuration" AS ENUM ('MIN_15', 'MIN_30', 'MIN_45', 'MIN_60_PLUS');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "GoalType" NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "location" "TrainingLocation" NOT NULL,
    "equipment" "Equipment"[],
    "sessionDuration" "SessionDuration" NOT NULL,
    "weeklyFrequency" INTEGER NOT NULL,
    "level" "ExperienceLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_preferences_userId_key" ON "training_preferences"("userId");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_preferences" ADD CONSTRAINT "training_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
