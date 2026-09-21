import { Injectable } from '@nestjs/common';
import { GoalStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubmitOnboardingDto } from './dto/submit-onboarding.dto.js';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(userId: string, dto: SubmitOnboardingDto) {
    return this.prisma.$transaction(async (tx) => {
      const activeGoals = await tx.goal.findMany({
        where: { userId, status: GoalStatus.ACTIVE },
      });

      const toPause = activeGoals.filter((goal) => !dto.goals.includes(goal.type));
      const existingActiveTypes = new Set(activeGoals.map((goal) => goal.type));
      const toCreate = dto.goals.filter((type) => !existingActiveTypes.has(type));

      if (toPause.length > 0) {
        await tx.goal.updateMany({
          where: { id: { in: toPause.map((goal) => goal.id) } },
          data: { status: GoalStatus.PAUSED, pausedAt: new Date() },
        });
      }

      if (toCreate.length > 0) {
        await tx.goal.createMany({
          data: toCreate.map((type) => ({ userId, type })),
        });
      }

      const preferences = await tx.trainingPreferences.upsert({
        where: { userId },
        create: {
          userId,
          location: dto.location,
          equipment: dto.equipment,
          sessionDuration: dto.sessionDuration,
          weeklyFrequency: dto.weeklyFrequency,
          level: dto.level,
        },
        update: {
          location: dto.location,
          equipment: dto.equipment,
          sessionDuration: dto.sessionDuration,
          weeklyFrequency: dto.weeklyFrequency,
          level: dto.level,
        },
      });

      const goals = await tx.goal.findMany({ where: { userId, status: GoalStatus.ACTIVE } });

      return { goals, preferences };
    });
  }
}
