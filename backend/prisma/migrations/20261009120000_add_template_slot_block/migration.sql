-- CreateEnum
CREATE TYPE "WorkoutBlock" AS ENUM ('WARMUP', 'MAIN', 'COOLDOWN');

-- DropIndex
DROP INDEX "template_slots_templateId_order_key";

-- AlterTable
ALTER TABLE "template_slots" ADD COLUMN     "block" "WorkoutBlock" NOT NULL DEFAULT 'MAIN';

-- CreateIndex
CREATE UNIQUE INDEX "template_slots_templateId_block_order_key" ON "template_slots"("templateId", "block", "order");
