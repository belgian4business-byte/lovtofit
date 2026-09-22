-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'LEGS_GLUTES', 'CORE', 'CARDIO', 'MOBILITY');

-- CreateEnum
CREATE TYPE "MovementPattern" AS ENUM ('PUSH', 'PULL', 'SQUAT', 'HINGE', 'LUNGE', 'CARRY', 'CORE_STABILITY', 'ROTATION', 'CARDIO', 'MOBILITY');

-- CreateEnum
CREATE TYPE "ExerciseEquipment" AS ENUM ('BODYWEIGHT', 'DUMBBELL', 'BARBELL', 'MACHINE_CABLE');

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscleGroup" "MuscleGroup" NOT NULL,
    "movementPattern" "MovementPattern" NOT NULL,
    "equipment" "ExerciseEquipment" NOT NULL,
    "level" "ExperienceLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_name_key" ON "exercises"("name");
