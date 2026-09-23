import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AiCoachService } from '../ai-coach/ai-coach.service.js';
import { FeatureAccessService } from '../feature-access/feature-access.service.js';
import type { Exercise } from '../generated/prisma/client.js';
import type {
  EnergyLevel,
  Equipment,
  ExerciseEquipment,
  ExperienceLevel,
  MovementPattern,
  ProgressionDecision,
} from '../generated/prisma/enums.js';
import { MotivationEngineService } from '../motivation-engine/motivation-engine.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecoveryEngineService } from '../recovery-engine/recovery-engine.service.js';
import { estimateWorkoutSeconds, RuleGuardService } from '../rule-guard/rule-guard.service.js';

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

/**
 * Hoeveel reps de volgende keer doel worden gegeven de laatste
 * Progression-beslissing (INCREASE +2, DECREASE -2, binnen 6-20). Losse,
 * exporteerbare functie (i.p.v. alleen een classmethode) zodat de Coach-tab
 * na een training dezelfde regel kan gebruiken om de progressie-uitkomst te
 * tonen (CLAUDE.md Fase 4, stap 4) — één plek voor deze regel, geen
 * herhaalde 6-20-clamping elders.
 */
export function repsForProgressionDecision(decision: ProgressionDecision | undefined): number {
  if (decision === 'INCREASE') {
    return Math.min(DEFAULT_TARGET_REPS + 2, MAX_TARGET_REPS);
  }
  if (decision === 'DECREASE') {
    return Math.max(DEFAULT_TARGET_REPS - 2, MIN_TARGET_REPS);
  }
  return DEFAULT_TARGET_REPS;
}

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

export interface TodaysWorkoutWithEnergy extends TodaysWorkout {
  /** Wat de gebruiker koos in de energie-check; null = overgeslagen. */
  energyLevel: EnergyLevel | null;
  /** true = Light Session (lage energie) — voor "Aangepast aan je energie vandaag". */
  energyAdjusted: boolean;
  restSeconds: number;
}

// Light Session bij lage energie (Fase 8; blueprint v0.6 §10 "minder sets,
// lagere intensiteit, langere rust, eenvoudige oefeningen — 3×12 → 2×10",
// v1.9 #23 "reduce volume, reduce intensity, prefer familiar exercises",
// v2.0 test 08 "3 sets → 2", v2.4.5 "langere rust geven"). Bewust géén
// oefeningen weglaten: de volledige-lichaamsbalans blijft, alleen lichter.
export const LIGHT_SESSION_SETS = 2;
export const LIGHT_SESSION_REPS_REDUCTION = 2;
export const LIGHT_SESSION_REST_SECONDS = 60;
const NORMAL_REST_SECONDS_FOR_RESPONSE = 45;

/**
 * Maakt een al veilig samengestelde workout lichter (pure functie). Kan de
 * workout alleen lichter maken, nooit zwaarder — reps blijven binnen de
 * 6-20-bandbreedte die RG06 afdwingt.
 */
export function applyLightSession(slots: TodaysWorkoutSlot[]): TodaysWorkoutSlot[] {
  return slots.map((slot) => ({
    ...slot,
    targetSets: Math.min(slot.targetSets, LIGHT_SESSION_SETS),
    targetReps: Math.max(slot.targetReps - LIGHT_SESSION_REPS_REDUCTION, MIN_TARGET_REPS),
  }));
}

export interface QuickSession extends TodaysWorkout {
  status: 'AVAILABLE';
  sessionType: 'QUICK';
  availableMinutes: number;
  estimatedMinutes: number;
  /** "Beperkte rust" (v0.7.10) — korter dan de normale 45 sec. */
  restSeconds: number;
}

/**
 * Fase 7, stap 2: zonder `CAN_USE_QUICK_SESSION` wordt er geen workout
 * samengesteld of meegestuurd — alleen de uitleg voor de teaser (zelfde
 * patroon als `PREMIUM_REQUIRED` bij het caloriedoel, v2.19.13/v2.19.22).
 */
export interface QuickSessionLocked {
  status: 'PREMIUM_REQUIRED';
  coachMessage: string;
}

// Vaste keuzes i.p.v. een vrij bereik: bij 15 min zit het maximum van 4
// bewegingen × 3 sets (v0.7.10) al vol, dus meer tijd levert geen andere
// Quick Session op — wie meer tijd heeft, doet de normale training. 10 min
// = ondergrens uit blueprint v2.0 test 03. Dezelfde lijst staat in de app
// (train_screen.dart).
export const QUICK_SESSION_MINUTE_OPTIONS = [10, 15] as const;
export const QUICK_SESSION_REST_SECONDS = 30;

// v0.6 §9: "belangrijkste compound/movement → tegenovergestelde beweging →
// benen → core/cardio". De template-patronen in volgorde van belangrijkheid;
// wat niet in deze lijst staat komt achteraan.
const QUICK_SESSION_PRIORITY: MovementPattern[] = [
  'SQUAT',
  'PUSH',
  'PULL',
  'CORE_STABILITY',
  'HINGE',
  'LUNGE',
  'CARRY',
  'ROTATION',
  'CARDIO',
  'MOBILITY',
];

// v0.7.10: "3–4 belangrijke bewegingen". Liever meer bewegingen met 2 sets
// dan minder met 3 — een Quick Session blijft een volledige (korte)
// training. Nooit onder 2 sets per oefening ("minimale uitvoerbaarheid",
// v2.0 test 03): dan eerder een oefening minder.
const QUICK_SESSION_MAX_EXERCISES = 4;
const QUICK_SESSION_SETS_OPTIONS = [3, 2];

/**
 * Kort een al veilig samengestelde workout in tot hij binnen `minutes`
 * past (blueprint v2.5.4: "reduce exercises OR reduce sets … tot
 * estimated_duration <= available_time"). Pure functie, geen databasewerk:
 * de oefeningen zelf zijn al gekozen door dezelfde beslisladder als de
 * normale training ("dezelfde trainingslogica, maar compacter", v0.7.10).
 *
 * Volgorde: v0.6 §9-prioriteit, maar een patroon dat op RECOVERY staat
 * schuift naar achteren (herstel weegt zwaarder, v0.7.6) — bij weinig tijd
 * valt dat dus als eerste af.
 */
export function planQuickSession(
  slots: TodaysWorkoutSlot[],
  recoveryByPattern: Map<string, string>,
  minutes: number,
): { slots: TodaysWorkoutSlot[]; estimatedSeconds: number } | null {
  const rank = (pattern: MovementPattern) => {
    const index = QUICK_SESSION_PRIORITY.indexOf(pattern);
    return index === -1 ? QUICK_SESSION_PRIORITY.length : index;
  };
  const prioritized = [...slots].sort((a, b) => {
    const aRecovery = recoveryByPattern.get(a.movementPattern) === 'RECOVERY' ? 1 : 0;
    const bRecovery = recoveryByPattern.get(b.movementPattern) === 'RECOVERY' ? 1 : 0;
    return aRecovery - bRecovery || rank(a.movementPattern) - rank(b.movementPattern);
  });

  const limitSeconds = minutes * 60;
  for (let count = Math.min(QUICK_SESSION_MAX_EXERCISES, prioritized.length); count >= 1; count--) {
    for (const sets of QUICK_SESSION_SETS_OPTIONS) {
      const estimatedSeconds = estimateWorkoutSeconds(count * sets, QUICK_SESSION_REST_SECONDS);
      if (estimatedSeconds <= limitSeconds) {
        return {
          slots: prioritized.slice(0, count).map((slot, index) => ({ ...slot, order: index, targetSets: sets })),
          estimatedSeconds,
        };
      }
    }
  }
  return null;
}

/**
 * Decision Engine v2 — volledige beslisladder met veiligheid eerst
 * (CLAUDE.md Fase 3, stap 4; bron: blueprint v0.7 + v1.9).
 *
 * Quick Session bij tijdgebrek: `getQuickSession()` (Fase 7) — zelfde
 * beslisladder, daarna ingekort met `planQuickSession()`.
 *
 * Bewust NIET in deze stap (vereisen nieuwe schermen/inputs die nog niet
 * bestaan, dus expliciet uitgesteld i.p.v. stiekem meegebouwd):
 * energie-check-in ("hoe voel je je
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
    private readonly featureAccess: FeatureAccessService,
  ) {}

  /**
   * @param energyLevel Optionele energie-check (Fase 8). Alleen LOW past de
   * training aan (Light Session); NORMAL/HIGH/overgeslagen = normale
   * training. Een modifier bovenop dezelfde beslisladder: veiligheid,
   * pijn-uitsluiting en de Rule Guard blijven onverminderd gelden.
   */
  async getTodaysWorkout(userId: string, energyLevel?: EnergyLevel): Promise<TodaysWorkoutWithEnergy> {
    const isLowEnergy = energyLevel === 'LOW';
    const selection = await this.selectWorkout(userId, { preferLightestVariant: isLowEnergy });
    const { preferences, template, recoveryByPattern, decisionByChosenExercise } = selection;

    const slots = isLowEnergy ? applyLightSession(selection.slots) : selection.slots;
    const restSeconds = isLowEnergy ? LIGHT_SESSION_REST_SECONDS : NORMAL_REST_SECONDS_FOR_RESPONSE;

    const ruleGuardResult = this.ruleGuard.checkWorkout(slots, {
      preferences,
      recoveryByPattern,
      decisionByChosenExercise,
      restSeconds,
    });
    this.assertRuleGuardPassed(ruleGuardResult);

    const coachMessage = await this.explainWorkout(
      userId,
      slots,
      recoveryByPattern,
      decisionByChosenExercise,
      isLowEnergy,
    );

    return {
      templateId: template.id,
      templateName: template.name,
      slots,
      ruleGuardWarnings: ruleGuardResult.warnings,
      coachMessage,
      energyLevel: energyLevel ?? null,
      energyAdjusted: isLowEnergy,
      restSeconds,
    };
  }

  /**
   * Quick Session (CLAUDE.md Fase 7, stap 1; bron: blueprint v0.6 §9,
   * v0.7.10, v1.9 §7, v2.5.4). De gebruiker kiest zelf hoeveel minuten hij
   * vandaag heeft. Oefeningkeuze = exact dezelfde beslisladder als de
   * normale training (veiligheid, pijn, herstel, progressie), daarna
   * ingekort tot hij binnen de tijd past. De Rule Guard controleert
   * onafhankelijk, met de tijd als harde grens (RG04).
   *
   * Reps blijven die van de progressiebeslissing: een Quick Session mag de
   * normale progressie niet verstoren (v0.8.11). De Progression Engine
   * vergelijkt gemiddelden per set, dus minder sets telt niet als
   * achteruitgang.
   */
  async getQuickSession(userId: string, minutes: number): Promise<QuickSession | QuickSessionLocked> {
    // Premium eerst: voor een FREE-gebruiker wordt niets berekend. Wat al
    // opgehaald is, blijft bruikbaar — opslaan (POST /workouts/sessions)
    // checkt geen Premium, dus verloopt Premium tijdens de training, dan
    // gaat de training gewoon door (v2.19.11, FA-007).
    if (!(await this.featureAccess.canUse(userId, 'CAN_USE_QUICK_SESSION'))) {
      return { status: 'PREMIUM_REQUIRED', coachMessage: this.aiCoach.explainQuickSessionLocked() };
    }

    const selection = await this.selectWorkout(userId);
    const { preferences, template, recoveryByPattern, decisionByChosenExercise } = selection;

    const plan = planQuickSession(selection.slots, recoveryByPattern, minutes);
    if (!plan) {
      // Kan niet bij de toegestane QUICK_SESSION_MINUTE_OPTIONS (validatie
      // in de controller); vangnet voor als die ooit veranderen.
      throw new BadRequestException(`In ${minutes} minuten past geen zinvolle training.`);
    }

    const ruleGuardResult = this.ruleGuard.checkWorkout(plan.slots, {
      preferences,
      recoveryByPattern,
      decisionByChosenExercise,
      timeLimit: { minutes, restSeconds: QUICK_SESSION_REST_SECONDS },
    });
    this.assertRuleGuardPassed(ruleGuardResult);

    const hadRecentReplace = plan.slots.some((slot) => decisionByChosenExercise.get(slot.exercise.id) === 'REPLACE');
    const estimatedMinutes = Math.ceil(plan.estimatedSeconds / 60);

    return {
      templateId: template.id,
      templateName: template.name,
      slots: plan.slots,
      ruleGuardWarnings: ruleGuardResult.warnings,
      coachMessage: this.aiCoach.explainQuickSession({ estimatedMinutes, exerciseCount: plan.slots.length, hadRecentReplace }),
      status: 'AVAILABLE',
      sessionType: 'QUICK',
      availableMinutes: minutes,
      estimatedMinutes,
      restSeconds: QUICK_SESSION_REST_SECONDS,
    };
  }

  private assertRuleGuardPassed(result: { passed: boolean; violations: string[] }): void {
    if (!result.passed) {
      // Geen regenereer-lus in v1: bij een schending is er ergens een fout
      // in de Decision Engine zelf (deze zouden al hard gefilterd moeten
      // zijn). Beter luid falen dan stilzwijgend iets onveiligs serveren.
      throw new InternalServerErrorException(
        `Rule Guard blokkeerde deze workout: ${result.violations.join(' | ')}`,
      );
    }
  }

  private async explainWorkout(
    userId: string,
    slots: TodaysWorkoutSlot[],
    recoveryByPattern: Map<MovementPattern, string>,
    decisionByChosenExercise: Map<string, ProgressionDecision | undefined>,
    isLowEnergy: boolean,
  ): Promise<string> {
    const motivation = await this.motivationEngine.getStatus(userId);
    const hasRecentlyLoadedPattern = slots.some((slot) => {
      const status = recoveryByPattern.get(slot.movementPattern);
      return status === 'RECENTLY_LOADED' || status === 'RECOVERY';
    });
    const hadRecentReplace = [...decisionByChosenExercise.values()].some((d) => d === 'REPLACE');
    return this.aiCoach.explainTodaysWorkout({
      motivationSignal: motivation.signal,
      hasRecentlyLoadedPattern,
      hadRecentReplace,
      isLowEnergy,
    });
  }

  /**
   * Veiligheid + score per slot — gedeeld door normale training en Quick
   * Session. `preferLightestVariant` (lage energie): elk patroon krijgt de
   * lichtste variant-voorrang die anders alleen een recent belast patroon
   * krijgt ("avoid unnecessary complexity", v1.9 #23).
   */
  private async selectWorkout(userId: string, options: { preferLightestVariant?: boolean } = {}) {
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
          preferLightestVariant: options.preferLightestVariant ?? false,
        }),
      }));
      scored.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
      const chosen = scored[0].exercise;

      const targetReps = repsForProgressionDecision(latestDecisionByExercise.get(chosen.id));
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

    return { preferences, template, slots, recoveryByPattern, decisionByChosenExercise };
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
      preferLightestVariant: boolean;
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
    if ((patternIsLoaded || context.preferLightestVariant) && exercise.level === context.lightestLevelInPool) {
      score += 30;
    }

    if (context.lastExerciseId === exercise.id) score += 20;

    if (context.decision === 'INCREASE') score += 15;
    else if (context.decision === 'KEEP') score += 5;
    else if (context.decision === 'DECREASE') score -= 10;

    if (exercise.level === context.preferredLevel) score += 10;

    return score;
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
