import { Injectable } from '@nestjs/common';
import { GoalStatus, GoalType } from '../generated/prisma/enums.js';
import { FeatureAccessService } from '../feature-access/feature-access.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

// PREMIUM_REQUIRED (Fase 6, stap 3): de gebruiker heeft wél een gewichtsdoel,
// maar de range is een Premium-functie (blueprint v1.3 §7 / v2.17.9). Dan
// gaat er geen range mee naar de app — de backend beslist, niet de app
// (v2.19.22).
export const CALORIE_GOAL_STATUSES = [
  'NOT_APPLICABLE',
  'PREMIUM_REQUIRED',
  'LIMITED_ESTIMATE',
  'HAS_RANGE',
] as const;
export type CalorieGoalStatus = (typeof CALORIE_GOAL_STATUSES)[number];

// Alleen deze twee doelen hebben een richting nodig (tekort/overschot,
// blueprint v2.17.16 pseudocode: "IF goal == WEIGHT_LOSS ... IF goal ==
// MUSCLE_GAIN ..."). GET_STRONGER/IMPROVE_CONDITION/GET_FIT krijgen
// bewust geen caloriedoel — "geen agressieve calorie-aanpassing" als er
// geen gewichtsgerelateerd doel is (blueprint v1.3 §3).
const WEIGHT_RELATED_GOALS: GoalType[] = [GoalType.LOSE_WEIGHT, GoalType.BUILD_MUSCLE];

// Simpele vuistregel (~30 kcal/kg), geen Mifflin-St Jeor-achtige BMR-
// formule — die heeft lengte + leeftijd nodig, die we nog niet
// verzamelen. Beter een eerlijke, simpele richtwaarde dan een precisie
// verzinnen die we niet kunnen onderbouwen (blueprint v2.17.12
// "Insufficient Data"). Zelfde soort aanpak als de waterformule.
const BASELINE_KCAL_PER_KG = 30;
const RANGE_WIDTH_FRACTION = 0.1;
const LOSE_WEIGHT_DEFICIT_FRACTION = 0.15;
const BUILD_MUSCLE_SURPLUS_FRACTION = 0.1;
const ROUND_TO_KCAL = 50;

export interface CalorieGoalReport {
  status: CalorieGoalStatus;
  goalType: GoalType | null;
  rangeLowKcal: number | null;
  rangeHighKcal: number | null;
}

function roundKcal(value: number): number {
  return Math.round(value / ROUND_TO_KCAL) * ROUND_TO_KCAL;
}

/**
 * Fase 5, stap 4 (bron: blueprint v1.3 §3/§4 + v2.17.16). Geeft nooit één
 * "magisch getal" (v1.3 §4) — altijd een range, en alleen als er een
 * gewichtsgerelateerd doel actief is ("alleen bij een gewichtsdoel").
 * Sinds Fase 6, stap 3 alleen voor wie `CAN_USE_CALORIE_RANGE` heeft.
 */
@Injectable()
export class CalorieGoalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureAccess: FeatureAccessService,
  ) {}

  async getStatus(userId: string): Promise<CalorieGoalReport> {
    const relevantGoal = await this.prisma.goal.findFirst({
      where: { userId, status: GoalStatus.ACTIVE, type: { in: WEIGHT_RELATED_GOALS } },
      orderBy: { createdAt: 'asc' },
    });

    if (!relevantGoal) {
      return { status: 'NOT_APPLICABLE', goalType: null, rangeLowKcal: null, rangeHighKcal: null };
    }

    // Pas na de doel-check: wie geen gewichtsdoel heeft, krijgt ook geen
    // Premium-teaser (geen upsell zonder echte behoefte, v2.19.14).
    if (!(await this.featureAccess.canUse(userId, 'CAN_USE_CALORIE_RANGE'))) {
      return {
        status: 'PREMIUM_REQUIRED',
        goalType: relevantGoal.type,
        rangeLowKcal: null,
        rangeHighKcal: null,
      };
    }

    const latestMeasurement = await this.prisma.bodyMeasurement.findFirst({
      where: { userId },
      orderBy: { measuredAt: 'desc' },
      select: { weightKg: true },
    });

    if (!latestMeasurement) {
      return {
        status: 'LIMITED_ESTIMATE',
        goalType: relevantGoal.type,
        rangeLowKcal: null,
        rangeHighKcal: null,
      };
    }

    const baselineKcal = latestMeasurement.weightKg * BASELINE_KCAL_PER_KG;
    const directionFraction =
      relevantGoal.type === GoalType.LOSE_WEIGHT
        ? -LOSE_WEIGHT_DEFICIT_FRACTION
        : BUILD_MUSCLE_SURPLUS_FRACTION;
    const centerKcal = baselineKcal * (1 + directionFraction);

    return {
      status: 'HAS_RANGE',
      goalType: relevantGoal.type,
      rangeLowKcal: roundKcal(centerKcal * (1 - RANGE_WIDTH_FRACTION)),
      rangeHighKcal: roundKcal(centerKcal * (1 + RANGE_WIDTH_FRACTION)),
    };
  }
}
