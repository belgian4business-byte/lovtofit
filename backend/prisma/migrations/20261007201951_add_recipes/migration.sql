-- CreateEnum
CREATE TYPE "RecipeGoal" AS ENUM ('LOSE_WEIGHT', 'BUILD_MUSCLE', 'GENERAL');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" "RecipeGoal" NOT NULL,
    "mealType" "MealType" NOT NULL,
    "description" TEXT NOT NULL,
    "ingredients" TEXT[],
    "steps" TEXT[],
    "kcalMin" INTEGER NOT NULL,
    "kcalMax" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipes_name_key" ON "recipes"("name");

-- CreateIndex
CREATE INDEX "recipes_goal_idx" ON "recipes"("goal");
