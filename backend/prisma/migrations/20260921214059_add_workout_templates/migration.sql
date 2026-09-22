-- CreateTable
CREATE TABLE "workout_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "ExperienceLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_slots" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "movementPattern" "MovementPattern" NOT NULL,

    CONSTRAINT "template_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_templates_name_key" ON "workout_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "template_slots_templateId_order_key" ON "template_slots"("templateId", "order");

-- AddForeignKey
ALTER TABLE "template_slots" ADD CONSTRAINT "template_slots_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "workout_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
