-- CreateEnum
CREATE TYPE "EnergyLevel" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "energyLevel" "EnergyLevel";
