import { Injectable } from '@nestjs/common';
import { FeatureAccessService } from '../feature-access/feature-access.service.js';
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
  isFree: true,
} as const;

/**
 * FULL = alle recepten open (Premium, CAN_USE_RECIPES). PREMIUM_REQUIRED =
 * alleen de gratis recepten open, de rest vergrendeld (zelfde patroon als
 * het caloriedoel en Quick Session).
 */
export type RecipeAccess = 'FULL' | 'PREMIUM_REQUIRED';

/**
 * Fase 11: de recepten die bij de actieve doelen van de gebruiker passen.
 * Gesorteerd op maaltijd (ontbijt → lunch → diner → snack, de volgorde van
 * de enum) en daarbinnen op naam.
 *
 * Freemium (stap 2): zonder CAN_USE_RECIPES zijn alleen de recepten met
 * `isFree` open. Een vergrendeld recept komt mee als teaser (naam, maaltijd,
 * omschrijving, kcal-range), maar ingrediënten en bereiding verlaten de
 * server niet — de backend beslist, de app toont alleen.
 */
@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureAccess: FeatureAccessService,
  ) {}

  async getForUser(userId: string) {
    const [activeGoals, canUseAll] = await Promise.all([
      this.prisma.goal.findMany({
        where: { userId, status: GoalStatus.ACTIVE },
        select: { type: true },
      }),
      this.featureAccess.canUse(userId, 'CAN_USE_RECIPES'),
    ]);
    const goals = recipeGoalsFor(activeGoals.map((goal) => goal.type));

    const rows = await this.prisma.recipe.findMany({
      where: { goal: { in: goals } },
      orderBy: [{ mealType: 'asc' }, { name: 'asc' }],
      select: RECIPE_SELECT,
    });

    const recipes = rows.map(({ isFree, ingredients, steps, ...teaser }) => {
      const locked = !canUseAll && !isFree;
      return locked
        ? { ...teaser, locked, ingredients: null, steps: null }
        : { ...teaser, locked, ingredients, steps };
    });
    const access: RecipeAccess = canUseAll ? 'FULL' : 'PREMIUM_REQUIRED';

    return { goals, access, recipes };
  }
}
