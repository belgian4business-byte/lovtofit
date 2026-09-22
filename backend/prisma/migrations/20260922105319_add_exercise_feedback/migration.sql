-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'GOOD', 'HARD', 'TOO_HARD');

-- CreateTable
CREATE TABLE "exercise_feedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "discomfort" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_feedback_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "exercise_feedback" ADD CONSTRAINT "exercise_feedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_feedback" ADD CONSTRAINT "exercise_feedback_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
