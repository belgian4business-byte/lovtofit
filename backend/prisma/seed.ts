import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { EXERCISES } from './seed-data/exercises.js';
import { TEMPLATES } from './seed-data/templates.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  for (const exercise of EXERCISES) {
    await prisma.exercise.upsert({
      where: { name: exercise.name },
      create: exercise,
      update: exercise,
    });
  }
  console.log(`Geseed: ${EXERCISES.length} oefeningen.`);

  for (const template of TEMPLATES) {
    await prisma.$transaction(async (tx) => {
      const saved = await tx.workoutTemplate.upsert({
        where: { name: template.name },
        create: { name: template.name, level: template.level },
        update: { level: template.level },
      });

      await tx.templateSlot.deleteMany({ where: { templateId: saved.id } });
      await tx.templateSlot.createMany({
        data: template.slots.map((movementPattern, index) => ({
          templateId: saved.id,
          order: index,
          movementPattern,
        })),
      });
    });
  }
  console.log(`Geseed: ${TEMPLATES.length} template(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
