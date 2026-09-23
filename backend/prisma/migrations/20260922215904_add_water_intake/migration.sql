-- CreateTable
CREATE TABLE "water_intake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMl" INTEGER NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_intake_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "water_intake" ADD CONSTRAINT "water_intake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
