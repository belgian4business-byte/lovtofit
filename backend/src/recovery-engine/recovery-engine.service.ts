import { Injectable } from '@nestjs/common';
import { Difficulty, MovementPattern, MuscleGroup } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const RECOVERY_STATUSES = ['NORMAL', 'RECENTLY_LOADED', 'RECOVERY'] as const;
export type RecoveryStatus = (typeof RECOVERY_STATUSES)[number];

export interface RecoveryEntry<T extends string> {
  key: T;
  status: RecoveryStatus;
  loadScore: number;
}

export interface RecoveryReport {
  byMovementPattern: RecoveryEntry<MovementPattern>[];
  byMuscleGroup: RecoveryEntry<MuscleGroup>[];
}

const LOOKBACK_DAYS = 7;

// Perceived-exertion gewicht — hoe zwaarder de feedback, hoe meer een set
// meetelt voor de recente belasting.
const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  EASY: 0.7,
  GOOD: 1.0,
  HARD: 1.3,
  TOO_HARD: 1.6,
};

// Afnemend effect naarmate een training langer geleden is (blueprint
// v2.15.10) — geen harde "48 uur rust"-regel, gewoon minder gewicht.
function recencyWeight(daysAgo: number): number {
  if (daysAgo <= 1) return 1.0;
  if (daysAgo === 2) return 0.75;
  if (daysAgo <= 4) return 0.5;
  if (daysAgo <= 6) return 0.3;
  return 0.1;
}

function statusFor(loadScore: number): RecoveryStatus {
  if (loadScore >= 60) return 'RECOVERY';
  if (loadScore >= 20) return 'RECENTLY_LOADED';
  return 'NORMAL';
}

/**
 * Recovery Engine v1 (CLAUDE.md Fase 3, stap 3; bron: blueprint v0.9 +
 * v2.15). Schat, per movement pattern én per spiergroep, hoe zwaar de
 * gebruiker dat de afgelopen 7 dagen belastte, en vertaalt dat naar één
 * van drie statussen. Bewust géén nep-precisie (geen "73% hersteld") en
 * geen harde "48 uur rust"-regel — enkel recente-belasting + verval
 * (blueprint v2.15.1/v2.15.8). Dit is een modifier voor de (latere)
 * Decision Engine, geen eigen beslissing (v2.15.3) — nog niet gekoppeld.
 */
@Injectable()
export class RecoveryEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string): Promise<RecoveryReport> {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const [sets, feedbackRows] = await Promise.all([
      this.prisma.loggedSet.findMany({
        where: { session: { userId, completedAt: { gte: since } } },
        include: {
          exercise: { select: { movementPattern: true, muscleGroup: true } },
          session: { select: { id: true, completedAt: true } },
        },
      }),
      this.prisma.exerciseFeedback.findMany({
        where: { session: { userId, completedAt: { gte: since } } },
        select: { sessionId: true, exerciseId: true, difficulty: true },
      }),
    ]);

    const feedbackByKey = new Map(
      feedbackRows.map((f) => [`${f.sessionId}:${f.exerciseId}`, f.difficulty]),
    );

    const patternScores = new Map<MovementPattern, number>();
    const muscleScores = new Map<MuscleGroup, number>();
    const now = Date.now();

    for (const set of sets) {
      const difficulty = feedbackByKey.get(`${set.sessionId}:${set.exerciseId}`) ?? 'GOOD';
      const daysAgo = Math.floor((now - set.session.completedAt.getTime()) / (24 * 60 * 60 * 1000));
      // Eén LoggedSet-rij = één uitgevoerde set; optellen over alle sets
      // van de afgelopen week geeft "sets x reps" vanzelf.
      const score = set.reps * DIFFICULTY_WEIGHT[difficulty] * recencyWeight(daysAgo);

      const { movementPattern, muscleGroup } = set.exercise;
      patternScores.set(movementPattern, (patternScores.get(movementPattern) ?? 0) + score);
      muscleScores.set(muscleGroup, (muscleScores.get(muscleGroup) ?? 0) + score);
    }

    return {
      byMovementPattern: Object.values(MovementPattern).map((pattern) => {
        const loadScore = patternScores.get(pattern) ?? 0;
        return { key: pattern, status: statusFor(loadScore), loadScore };
      }),
      byMuscleGroup: Object.values(MuscleGroup).map((group) => {
        const loadScore = muscleScores.get(group) ?? 0;
        return { key: group, status: statusFor(loadScore), loadScore };
      }),
    };
  }
}
