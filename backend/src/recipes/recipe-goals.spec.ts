import { describe, expect, it } from 'vitest';
import { GoalType, RecipeGoal } from '../generated/prisma/enums.js';
import { recipeGoalsFor } from './recipe-goals.js';

describe('recipeGoalsFor', () => {
  it('Afvallen en Spieren opbouwen hebben een eigen receptenset', () => {
    expect(recipeGoalsFor([GoalType.LOSE_WEIGHT])).toEqual([RecipeGoal.LOSE_WEIGHT]);
    expect(recipeGoalsFor([GoalType.BUILD_MUSCLE])).toEqual([RecipeGoal.BUILD_MUSCLE]);
  });

  it('Sterker worden, Conditie verbeteren en Fit worden → algemeen gezond', () => {
    for (const goal of [GoalType.GET_STRONGER, GoalType.IMPROVE_CONDITION, GoalType.GET_FIT]) {
      expect(recipeGoalsFor([goal])).toEqual([RecipeGoal.GENERAL]);
    }
  });

  it('meerdere doelen: de sets samen, zonder dubbels, in vaste volgorde', () => {
    expect(
      recipeGoalsFor([GoalType.GET_FIT, GoalType.LOSE_WEIGHT, GoalType.GET_STRONGER]),
    ).toEqual([RecipeGoal.LOSE_WEIGHT, RecipeGoal.GENERAL]);
  });

  it('zonder actief doel → algemeen gezond', () => {
    expect(recipeGoalsFor([])).toEqual([RecipeGoal.GENERAL]);
  });
});
