import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AiCoachService } from '../ai-coach/ai-coach.service.js';
import type { Exercise } from '../generated/prisma/client.js';
import type {
  Equipment,
  ExerciseEquipment,
  ExperienceLevel,
  MovementPattern,
  ProgressionDecision,
} from '../generated/prisma/enums.js';
import { MotivationEngineService } from '../motivation-engine/motivation-engine.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecoveryEngineService } from '../recovery-engine/recovery-engine.service.js';
import { RuleGuardService } from '../rule-guard/rule-guard.service.js';

/**
 * Welke Exercise-apparatuur een gebruiker kan gebruiken per stuk apparatuur
 * dat hij bij onboarding opgaf. Bodyweight is altijd beschikbaar.
 */
const EQUIPMENT_MAP: Record<Equipment, ExerciseEquipment[]> = {
  NONE: [],
  DUMBBELLS: ['DUMBBELL'],
  RESISTANCE_BANDS: [],
  KETTLEBELL: [],
  FULL_GYM: ['DUMBBELL', 'BARBELL', 'MACHINE_CABLE'],
};

// Welke oefenniveaus een gebruiker mag krijgen (blueprint v1.9, stap 3:
// "IF beginner -> difficulty <= beginner"). Een hard veiligheidsfilter,
// geen voorkeur.
const ALLOWED_LEVELS: Record<ExperienceLevel, ExperienceLevel[]> = {
  BEGINNER: ['BEGINNER'],
  INTERMEDIATE: ['BEGINNER', 'INTERMEDIATE'],
  ADVANCED: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
};

const DEFAULT_TARGET_SETS = 3;
const DEFAULT_TARGET_REPS = 12;
const MIN_TARGET_REPS = 6;
const MAX_TARGET_REPS = 20;

export interface TodaysWorkoutSlot {
  order: number;
  movementPattern: MovementPattern;
  targetSets: number;
  targetReps: number;
  exercise: {
    id: string;
    name: string;
    muscleGroup: string;
    equipment: string;
    level: string;
  };
}

export interface TodaysWorkout {
  templateId: string;
  templateName: string;
  slots: TodaysWorkoutSlot[];
  /** Niet-blokkerende Rule Guard-signalen (zie rule-guard.service.ts). */
  ruleGuardWarnings: string[];
  /** AI Coach-uitleg waarom de training er vandaag zo uitziet. */
  coachMessage: string;
}

/**
 * Decision Engine v2 — volledige beslisladder met veiligheid eerst
 * (CLAUDE.md Fase 3, stap 4; bron: blueprint v0.7 + v1.9).
 *
 * Bewust NIET in deze stap (vereisen nieuwe schermen/inputs die nog niet
 * bestaan, dus expliciet uitgesteld i.p.v. stiekem meegebouwd):
 * Quick Session bij tijdgebrek, energie-check-in ("hoe voel je je
 * vandaag"), weekplanning + "gemiste training"-herplanning, en handmatige
 * "vandaag aanpassen"-overrides (locatie/tijd/energie/oefening vervangen
 * via de UI). Regressie gebeurt hier via reps, niet via het wisselen naar
 * een makkelijkere oefeningsvariant (geen progressieladder per oefening
 * gemodelleerd) — bewust simpel, uit te breiden later.
 *
 * Beslisladder per slot:
 * 1. VEILIGHEID (hard, mag nooit overschreven worden):
 *    - niveau: alleen oefeningen op of onder het niveau van de gebruiker
 *      (blueprint v1.9 stap 3)
 *    - apparatuur: alleen wat de gebruiker beschikbaar heeft
 *    - een oefening met de laatste Progression-beslissing REPLACE
 *      (= recent pijn/ongemak gemeld) wordt uitgesloten (v0.7.5, v1.9
 *      stap 1) — "zwaar" mag aanpassen, "pijn" sluit uit.
 * 2. SLIM (score, geen harde uitsluiting):
 *    - continuïteit: dezelfde oefening als vorige keer krijgt voorrang
 *      ("niet iedere keer nieuwe oefeningen", v0.7.7)
 *    - progressie: INCREASE beloont, DECREASE ontmoedigt (maar sluit niet
 *      uit) die oefening
 *    - herstel: bij RECENTLY_LOADED/RECOVERY voor dit movement pattern
 *      krijgt de lichtste beschikbare variant (niveau) voorrang
 *    - niveau-fit: exacte match krijgt een bonus
 * 3. Reps passen mee met de progressiebeslissing van de gekozen oefening
 *    (INCREASE → meer reps, DECREASE → minder reps, binnen 6-20).
 */
@Injectable()
export class DecisionEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recoveryEngine: RecoveryEngineService,
    private readonly ruleGuard: RuleGuardService,
    private readonly motivationEngine: MotivationEngineService,
    private readonly aiCoach: AiCoachService,
  ) {}

  async getTodaysWorkout(userId: string): Promise<TodaysWorkout> {
    const preferences = await this.prisma.trainingPreferences.findUnique({ where: { userId } });
    if (!preferences) {
      throw new NotFoundException('Onboarding nog niet afgerond');
    }

    const templates = await this.prisma.workoutTemplate.findMany({
      include: { slots: { orderBy: { order: 'asc' } } },
    });
    if (templates.length === 0) {
      throw new NotFoundException('Geen trainingstemplates beschikbaar');
    }
    const template = templates.find((t) => t.level === preferences.level) ?? templates[0];

    const allowedEquipment = this.allowedExerciseEquipment(preferences.equipment);
    const allowedLevels = ALLOWED_LEVELS[preferences.level];

    const [recovery, lastExerciseByPattern] = await Promise.all([
      this.recoveryEngine.getStatus(userId),
      this.getLastExerciseByPattern(userId),
    ]);
    const recoveryByPattern = new Map(recovery.byMovementPattern.map((r) => [r.key, r.status]));

    const slots: TodaysWorkoutSlot[] = [];
    const decisionByChosenExercise = new Map<string, ProgressionDecision | undefined>();
    for (const slot of template.slots) {
      const candidates = await this.prisma.exercise.findMany({
        where: {
          movementPattern: slot.movementPattern,
          equipment: { in: allowedEquipment },
          level: { in: allowedLevels },
        },
        orderBy: { name: 'asc' },
      });
      if (candidates.length === 0) {
        throw new NotFoundException(
          `Geen geschikte oefening gevonden voor ${slot.movementPattern}`,
        );
      }

      const latestDecisionByExercise = await this.getLatestDecisions(
        userId,
        candidates.map((c) => c.id),
      );

      // Veiligheid eerst: sluit oefeningen uit die recent op pijn/ongemak
      // zijn gestopt. Val terug op alle kandidaten als dat níets overlaat
      // (kleine oefeningenbibliotheek) — anders zou de app volledig
      // vastlopen, wat erger is dan een niet-ideale keuze.
      const safeCandidates = candidates.filter(
        (c) => latestDecisionByExercise.get(c.id) !== 'REPLACE',
      );
      const pool = safeCandidates.length > 0 ? safeCandidates : candidates;

      const recoveryStatus = recoveryByPattern.get(slot.movementPattern) ?? 'NORMAL';
      const lightestLevelInPool = this.lightestLevel(pool);
      const lastExerciseId = lastExerciseByPattern.get(slot.movementPattern);

      const scored = pool.map((exercise) => ({
        exercise,
        score: this.scoreExercise(exercise, {
          preferredLevel: preferences.level,
          lastExerciseId,
          decision: latestDecisionByExercise.get(exercise.id),
          recoveryStatus,
          lightestLevelInPool,
        }),
      }));
      scored.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
      const chosen = scored[0].exercise;

      const targetReps = this.repsFor(latestDecisionByExercise.get(chosen.id));
      decisionByChosenExercise.set(chosen.id, latestDecisionByExercise.get(chosen.id));

      slots.push({
        order: slot.order,
        movementPattern: slot.movementPattern,
        targetSets: DEFAULT_TARGET_SETS,
        targetReps,
        exercise: {
          id: chosen.id,
          name: chosen.name,
          muscleGroup: chosen.muscleGroup,
          equipment: chosen.equipment,
          level: chosen.level,
        },
      });
    }

    const ruleGuardResult = this.ruleGuard.checkWorkout(slots, {
      preferences,
      recoveryByPattern,
      decisionByChosenExercise,
    });
    if (!ruleGuardResult.passed) {
      // Geen regenereer-lus in v1: bij een schending is er ergens een fout
      // in de Decision Engine zelf (deze zouden al hard gefilterd moeten
      // zijn). Beter luid falen dan stilzwijgend iets onveiligs serveren.
      throw new InternalServerErrorException(
        `Rule Guard blokkeerde deze workout: ${ruleGuardResult.violations.join(' | ')}`,
      );
    }

    const motivation = await this.motivationEngine.getStatus(userId);
    const hasRecentlyLoadedPattern = slots.some((slot) => {
      const status = recoveryByPattern.get(slot.movementPattern);
      return status === 'RECENTLY_LOADED' || status === 'RECOVERY';
    });
    const hadRecentReplace = [...decisionByChosenExercise.values()].some((d) => d === 'REPLACE');
    const coachMessage = this.aiCoach.explainTodaysWorkout({
      motivationSignal: motivation.signal,
      hasRecentlyLoadedPattern,
      hadRecentReplace,
    });

    return {
      templateId: template.id,
      templateName: template.name,
      slots,
      ruleGuardWarnings: ruleGuardResult.warnings,
      coachMessage,
    };
  }

  private allowedExerciseEquipment(userEquipment: Equipment[]): ExerciseEquipment[] {
    const allowed = new Set<ExerciseEquipment>(['BODYWEIGHT']);
    for (const equipment of userEquipment) {
      for (const mapped of EQUIPMENT_MAP[equipment]) {
        allowed.add(mapped);
      }
    }
    return [...allowed];
  }

  private lightestLevel(candidates: Exercise[]): ExperienceLevel {
    const order: ExperienceLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
    let lightest: ExperienceLevel = 'ADVANCED';
    for (const candidate of candidates) {
      if (order.indexOf(candidate.level) < order.indexOf(lightest)) {
        lightest = candidate.level;
      }
    }
    return lightest;
  }

  private scoreExercise(
    exercise: Exercise,
    context: {
      preferredLevel: ExperienceLevel;
      lastExerciseId: string | undefined;
      decision: ProgressionDecision | undefined;
      recoveryStatus: string;
      lightestLevelInPool: ExperienceLevel;
    },
  ): number {
    // Gewichten volgen de prioriteitsvolgorde uit blueprint v0.7.6: recente
    // belasting/herstel (prioriteit 3) weegt zwaarder dan progressie
    // (prioriteit 5) en weegt zwaarder dan een simpele niveau-voorkeur
    // (die geen genoemde prioriteit heeft — "gevorderd" betekent niet
    // automatisch "zo moeilijk mogelijk", v1.9 stap 3).
    let score = 0;

    const patternIsLoaded =
      context.recoveryStatus === 'RECENTLY_LOADED' || context.recoveryStatus === 'RECOVERY';
    if (patternIsLoaded && exercise.level === context.lightestLevelInPool) {
      score += 30;
    }

    if (context.lastExerciseId === exercise.id) score += 20;

    if (context.decision === 'INCREASE') score += 15;
    else if (context.decision === 'KEEP') score += 5;
    else if (context.decision === 'DECREASE') score -= 10;

    if (exercise.level === context.preferredLevel) score += 10;

    return score;
  }

  private repsFor(decision: ProgressionDecision | undefined): number {
    if (decision === 'INCREASE') {
      return Math.min(DEFAULT_TARGET_REPS + 2, MAX_TARGET_REPS);
    }
    if (decision === 'DECREASE') {
      return Math.max(DEFAULT_TARGET_REPS - 2, MIN_TARGET_REPS);
    }
    return DEFAULT_TARGET_REPS;
  }

  /** Laatst bekende Progression-beslissing per oefening (nieuwste eerst). */
  private async getLatestDecisions(
    userId: string,
    exerciseIds: string[],
  ): Promise<Map<string, ProgressionDecision>> {
    const rows = await this.prisma.exerciseProgression.findMany({
      where: { userId, exerciseId: { in: exerciseIds } },
      orderBy: { createdAt: 'desc' },
      select: { exerciseId: true, decision: true },
    });
    const latest = new Map<string, ProgressionDecision>();
    for (const row of rows) {
      if (!latest.has(row.exerciseId)) latest.set(row.exerciseId, row.decision);
    }
    return latest;
  }

  /** Welke oefening de gebruiker de laatste keer per movement pattern deed. */
  private async getLastExerciseByPattern(userId: string): Promise<Map<MovementPattern, string>> {
    const lastSession = await this.prisma.workoutSession.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      include: { loggedSets: { include: { exercise: { select: { movementPattern: true } } } } },
    });
    const map = new Map<MovementPattern, string>();
    if (!lastSession) return map;
    for (const set of lastSession.loggedSets) {
      if (!map.has(set.exercise.movementPattern)) {
        map.set(set.exercise.movementPattern, set.exerciseId);
      }
    }
    return map;
  }
}
