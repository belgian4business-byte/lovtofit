import { Injectable } from '@nestjs/common';
import { GoalStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { recipeGoalsFor } from './recipe-goals.js';

const RECIPE_SELECT = {
  id: true,
  name: true,
  goal: true,
  mealType: true,
  description: true,
  ingredients: true,
  steps: true,
  kcalMin: true,
  kcalMax: true,
} as const;

/**
 * Fase 11, stap 1: de recepten die bij de actieve doelen van de gebruiker
 * passen. Gesorteerd op maaltijd (ontbijt → lunch → diner → snack, de
 * volgorde van de enum) en daarbinnen op naam. Nog geen freemium-slot
 * (stap 2).
 */
@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string) {
    const activeGoals = await this.prisma.goal.findMany({
      where: { userId, status: GoalStatus.ACTIVE },
      select: { type: true },
    });
    const goals = recipeGoalsFor(activeGoals.map((goal) => goal.type));

    const recipes = await this.prisma.recipe.findMany({
      where: { goal: { in: goals } },
      orderBy: [{ mealType: 'asc' }, { name: 'asc' }],
      select: RECIPE_SELECT,
    });

    return { goals, recipes };
  }
}
