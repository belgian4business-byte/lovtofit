import { Injectable } from '@nestjs/common';
import { Difficulty, EnergyLevel, ProgressionDecision } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface CurrentSet {
  exerciseId: string;
  reps: number;
  weightKg?: number;
}

interface CurrentFeedback {
  exerciseId: string;
  difficulty: Difficulty;
  discomfort: boolean;
}

interface Performance {
  avgReps: number;
  avgWeightKg: number | null;
}

/**
 * Progression Engine v1 (CLAUDE.md Fase 3, stap 2; bron: blueprint v0.8 +
 * v2.14). Bepaalt per oefening, na een afgeronde sessie, wat er de
 * volgende keer moet gebeuren (KEEP/INCREASE/DECREASE/REPLACE/ADJUST).
 * Voert dit nog NIET uit — dat is aan de (latere) Decision Engine. Volgt
 * de pseudocode uit blueprint v2.14.13 zo letterlijk mogelijk.
 */
@Injectable()
export class ProgressionEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /** Evalueert elke oefening waarvoor feedback is gegeven, en bewaart de beslissing. */
  async evaluateSession(
    userId: string,
    sessionId: string,
    sets: CurrentSet[],
    feedback: CurrentFeedback[],
    energyLevel?: EnergyLevel,
  ): Promise<{ exerciseId: string; decision: ProgressionDecision }[]> {
    const decisions: { exerciseId: string; decision: ProgressionDecision }[] = [];

    // Fase 8: een Light Session (lage energie) zegt niets over progressie —
    // bewust minder sets/reps, en "zwaar" op een vermoeide dag is geen
    // trend. Net als bij Quick Session (v0.8.11) gaat de volgende normale
    // training verder waar de gebruiker gebleven was: er wordt dus géén
    // nieuwe beslissing opgeslagen (die zou bv. een eerdere INCREASE
    // overschrijven). Alleen pijn/ongemak telt altijd (veiligheid, v2.14.6).
    if (energyLevel === EnergyLevel.LOW) {
      for (const entry of feedback) {
        if (entry.discomfort) {
          await this.prisma.exerciseProgression.create({
            data: { userId, exerciseId: entry.exerciseId, sessionId, decision: ProgressionDecision.REPLACE },
          });
          decisions.push({ exerciseId: entry.exerciseId, decision: ProgressionDecision.REPLACE });
        } else {
          decisions.push({ exerciseId: entry.exerciseId, decision: await this.latestDecision(userId, entry.exerciseId) });
        }
      }
      return decisions;
    }

    for (const entry of feedback) {
      const decision = await this.evaluateExercise(userId, sessionId, sets, entry);
      await this.prisma.exerciseProgression.create({
        data: { userId, exerciseId: entry.exerciseId, sessionId, decision },
      });
      decisions.push({ exerciseId: entry.exerciseId, decision });
    }

    return decisions;
  }

  private async evaluateExercise(
    userId: string,
    sessionId: string,
    sets: CurrentSet[],
    current: CurrentFeedback,
  ): Promise<ProgressionDecision> {
    // Discomfort krijgt altijd voorrang — "zwaar" is iets anders dan pijn
    // (blueprint v2.14.6).
    if (current.discomfort) {
      return ProgressionDecision.REPLACE;
    }

    const history = await this.prisma.exerciseFeedback.findMany({
      where: {
        exerciseId: current.exerciseId,
        // Light Sessions tellen niet mee als vergelijkingspunt (anders telt
        // de volgende normale training als "meer reps dan vorige keer").
        // Expliciet OR met null: `not: LOW` alleen zou in SQL ook alle
        // sessies zonder energie-check uitsluiten.
        session: { userId, OR: [{ energyLevel: null }, { energyLevel: { not: EnergyLevel.LOW } }] },
        sessionId: { not: sessionId },
      },
      orderBy: { session: { completedAt: 'desc' } },
      take: 2,
      include: {
        session: { include: { loggedSets: { where: { exerciseId: current.exerciseId } } } },
      },
    });

    // Onvoldoende historie (eerste keer deze oefening): niets te vergelijken.
    if (history.length === 0) {
      return ProgressionDecision.KEEP;
    }

    // Eén slechte/geïsoleerde training verandert niets drastisch — maar
    // 3x op rij hetzelfde is een trend (blueprint v0.8.6 / v2.14.3/v2.14.4).
    const recentDifficulties = [current.difficulty, ...history.map((h) => h.difficulty)].slice(
      0,
      3,
    );
    if (
      recentDifficulties.length === 3 &&
      recentDifficulties.every((d) => d === Difficulty.TOO_HARD)
    ) {
      return ProgressionDecision.DECREASE;
    }
    if (
      recentDifficulties.length === 3 &&
      recentDifficulties.every((d) => d === Difficulty.EASY)
    ) {
      return ProgressionDecision.INCREASE;
    }

    // Geïsoleerde matige/slechte feedback: geen radicale wijziging.
    if (current.difficulty === Difficulty.HARD || current.difficulty === Difficulty.TOO_HARD) {
      return ProgressionDecision.KEEP;
    }

    const currentPerformance = this.averagePerformance(
      sets.filter((set) => set.exerciseId === current.exerciseId),
    );
    const previousPerformance = this.averagePerformance(
      history[0].session.loggedSets.map((set) => ({
        exerciseId: set.exerciseId,
        reps: set.reps,
        weightKg: set.weightKg ?? undefined,
      })),
    );

    if (
      current.difficulty === Difficulty.GOOD &&
      currentPerformance.avgReps === previousPerformance.avgReps &&
      currentPerformance.avgWeightKg === previousPerformance.avgWeightKg
    ) {
      return ProgressionDecision.KEEP;
    }

    const improved =
      currentPerformance.avgReps > previousPerformance.avgReps ||
      (currentPerformance.avgWeightKg ?? 0) > (previousPerformance.avgWeightKg ?? 0);
    if (improved && (current.difficulty === Difficulty.EASY || current.difficulty === Difficulty.GOOD)) {
      return ProgressionDecision.INCREASE;
    }

    return ProgressionDecision.KEEP;
  }

  /** Laatst opgeslagen beslissing voor deze oefening (zonder historie: KEEP). */
  private async latestDecision(userId: string, exerciseId: string): Promise<ProgressionDecision> {
    const latest = await this.prisma.exerciseProgression.findFirst({
      where: { userId, exerciseId },
      orderBy: { createdAt: 'desc' },
      select: { decision: true },
    });
    return latest?.decision ?? ProgressionDecision.KEEP;
  }

  private averagePerformance(sets: CurrentSet[]): Performance {
    if (sets.length === 0) {
      return { avgReps: 0, avgWeightKg: null };
    }
    const avgReps = sets.reduce((sum, set) => sum + set.reps, 0) / sets.length;
    const weights = sets.map((set) => set.weightKg).filter((w): w is number => w != null);
    const avgWeightKg = weights.length === 0 ? null : weights.reduce((a, b) => a + b, 0) / weights.length;
    return { avgReps, avgWeightKg };
  }
}
