-- CreateEnum
CREATE TYPE "ExerciseLocation" AS ENUM ('ANYWHERE', 'OUTDOOR');

-- AlterEnum
ALTER TYPE "ExerciseEquipment" ADD VALUE 'TREADMILL';

-- AlterEnum
ALTER TYPE "TrainingLocation" ADD VALUE 'OUTDOOR';

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "location" "ExerciseLocation" NOT NULL DEFAULT 'ANYWHERE';
