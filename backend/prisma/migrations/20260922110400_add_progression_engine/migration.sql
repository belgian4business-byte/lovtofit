-- CreateEnum
CREATE TYPE "ProgressionDecision" AS ENUM ('KEEP', 'INCREASE', 'DECREASE', 'REPLACE', 'ADJUST');

-- CreateTable
CREATE TABLE "exercise_progressions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "decision" "ProgressionDecision" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_progressions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "exercise_progressions" ADD CONSTRAINT "exercise_progressions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_progressions" ADD CONSTRAINT "exercise_progressions_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_progressions" ADD CONSTRAINT "exercise_progressions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
