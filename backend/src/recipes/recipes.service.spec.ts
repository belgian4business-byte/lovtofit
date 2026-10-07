import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RECIPES } from '../../prisma/seed-data/recipes.js';
import { GoalStatus, GoalType, MealType, RecipeGoal } from '../generated/prisma/enums.js';
import { RecipesService } from './recipes.service.js';

describe('RecipesService', () => {
  let prisma: {
    goal: { findMany: ReturnType<typeof vi.fn> };
    recipe: { findMany: ReturnType<typeof vi.fn> };
  };
  let service: RecipesService;

  beforeEach(() => {
    prisma = {
      goal: { findMany: vi.fn().mockResolvedValue([]) },
      recipe: { findMany: vi.fn().mockResolvedValue([]) },
    };
    service = new RecipesService(prisma as never);
  });

  it('kijkt alleen naar ACTIEVE doelen en haalt de recepten van het bijbehorende recept-doel op', async () => {
    prisma.goal.findMany.mockResolvedValue([{ type: GoalType.BUILD_MUSCLE }]);

    const result = await service.getForUser('user-1');

    expect(prisma.goal.findMany.mock.calls[0][0].where).toEqual({
      userId: 'user-1',
      status: GoalStatus.ACTIVE,
    });
    const query = prisma.recipe.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ goal: { in: [RecipeGoal.BUILD_MUSCLE] } });
    expect(query.orderBy).toEqual([{ mealType: 'asc' }, { name: 'asc' }]);
    expect(result.goals).toEqual([RecipeGoal.BUILD_MUSCLE]);
  });

  it('geeft de velden voor lijst en detail terug, geen interne tijdstempels', async () => {
    await service.getForUser('user-1');

    const select = prisma.recipe.findMany.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual(
      ['description', 'goal', 'id', 'ingredients', 'kcalMax', 'kcalMin', 'mealType', 'name', 'steps'].sort(),
    );
  });
});

// De vaste set uit de seed moet zich aan de regels van Fase 11 houden.
describe('seed-recepten (prisma/seed-data/recipes.ts)', () => {
  it('4 à 6 recepten per recept-doel', () => {
    for (const goal of Object.values(RecipeGoal)) {
      const count = RECIPES.filter((recipe) => recipe.goal === goal).length;
      expect(count, goal).toBeGreaterThanOrEqual(4);
      expect(count, goal).toBeLessThanOrEqual(6);
    }
  });

  it('elk doel heeft ontbijt, lunch, diner en een snack', () => {
    for (const goal of Object.values(RecipeGoal)) {
      const types = new Set(RECIPES.filter((recipe) => recipe.goal === goal).map((recipe) => recipe.mealType));
      expect([...types].sort(), goal).toEqual(Object.values(MealType).sort());
    }
  });

  it('kcal altijd als echte range (min < max, plausibel per portie)', () => {
    for (const recipe of RECIPES) {
      expect(recipe.kcalMin, recipe.name).toBeGreaterThan(50);
      expect(recipe.kcalMax, recipe.name).toBeGreaterThan(recipe.kcalMin);
      expect(recipe.kcalMax, recipe.name).toBeLessThan(1200);
    }
  });

  it('elk recept heeft een omschrijving, ingrediënten en bereiding; namen zijn uniek', () => {
    for (const recipe of RECIPES) {
      expect(recipe.description.length, recipe.name).toBeGreaterThan(0);
      expect((recipe.ingredients as string[]).length, recipe.name).toBeGreaterThan(0);
      expect((recipe.steps as string[]).length, recipe.name).toBeGreaterThan(0);
    }
    expect(new Set(RECIPES.map((recipe) => recipe.name)).size).toBe(RECIPES.length);
  });

  it('geen medische claims in de teksten', () => {
    const forbidden = /geneest|genezen|voorkomt|ziekte|medisch|vetverbrand|detox|afslank/i;
    for (const recipe of RECIPES) {
      const text = [recipe.name, recipe.description, ...(recipe.ingredients as string[]), ...(recipe.steps as string[])].join(' ');
      expect(text, recipe.name).not.toMatch(forbidden);
    }
  });
});
