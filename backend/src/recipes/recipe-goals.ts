import { GoalType, RecipeGoal } from '../generated/prisma/enums.js';

/**
 * Fase 11: welk recept-doel bij welk gebruikersdoel hoort. Afvallen en
 * Spieren opbouwen hebben een eigen set; Sterker worden, Conditie verbeteren
 * en Fit worden delen "algemeen gezond". Meerdere doelen → de sets samen.
 */
const RECIPE_GOAL_FOR: Record<GoalType, RecipeGoal> = {
  [GoalType.LOSE_WEIGHT]: RecipeGoal.LOSE_WEIGHT,
  [GoalType.BUILD_MUSCLE]: RecipeGoal.BUILD_MUSCLE,
  [GoalType.GET_STRONGER]: RecipeGoal.GENERAL,
  [GoalType.IMPROVE_CONDITION]: RecipeGoal.GENERAL,
  [GoalType.GET_FIT]: RecipeGoal.GENERAL,
};

/** Zonder actief doel (onboarding niet af) → algemeen gezond. */
export function recipeGoalsFor(goals: GoalType[]): RecipeGoal[] {
  if (goals.length === 0) return [RecipeGoal.GENERAL];
  const wanted = new Set(goals.map((goal) => RECIPE_GOAL_FOR[goal]));
  // Vaste volgorde, ongeacht de volgorde van de doelen.
  return Object.values(RecipeGoal).filter((goal) => wanted.has(goal));
}
