-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "suitableBlocks" "WorkoutBlock"[] DEFAULT ARRAY['MAIN']::"WorkoutBlock"[];
