import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { SubscriptionPlan } from '../src/generated/prisma/enums.js';
import { FEATURES } from '../src/feature-access/feature-keys.js';
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

  // Per functie een rij per plan (ook `enabled: false`), zodat de tabel
  // `plan_features` het volledige FREE/PREMIUM-overzicht toont.
  const features = Object.entries(FEATURES);
  for (const [featureKey, { description, plans }] of features) {
    const saved = await prisma.feature.upsert({
      where: { featureKey },
      create: { featureKey, description },
      update: { description },
    });

    for (const plan of Object.values(SubscriptionPlan)) {
      const enabled = (plans as readonly SubscriptionPlan[]).includes(plan);
      await prisma.planFeature.upsert({
        where: { plan_featureId: { plan, featureId: saved.id } },
        create: { plan, featureId: saved.id, enabled },
        update: { enabled },
      });
    }
  }
  console.log(`Geseed: ${features.length} functies (feature access).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
