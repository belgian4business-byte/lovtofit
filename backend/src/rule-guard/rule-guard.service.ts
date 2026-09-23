import { BadRequestException, Injectable } from '@nestjs/common';
import type { TrainingPreferences } from '../generated/prisma/client.js';
import type { ProgressionDecision, SessionDuration } from '../generated/prisma/enums.js';
import type { TodaysWorkoutSlot } from '../decision-engine/decision-engine.service.js';
import type { RecoveryStatus } from '../recovery-engine/recovery-engine.service.js';
import type { WeekSchedule } from '../schedule/week-schedule.js';

export interface RuleGuardContext {
  preferences: Pick<TrainingPreferences, 'location' | 'equipment' | 'level' | 'sessionDuration'>;
  recoveryByPattern: Map<string, RecoveryStatus>;
  decisionByChosenExercise: Map<string, ProgressionDecision | undefined>;
  /**
   * Quick Session (CLAUDE.md Fase 7): de gebruiker koos zelf hoeveel tijd hij
   * vandaag heeft. Dan is de tijd een harde grens (blueprint v2.5.4) en is
   * RG04 een blokkerende controle i.p.v. een waarschuwing — er bestaat nu
   * immers een manier om het op te lossen (inkorten).
   */
  timeLimit?: { minutes: number; restSeconds: number };
  /** Rust per set bij een normale training (Light Session: langer). Standaard 45 s. */
  restSeconds?: number;
}

export interface RuleGuardResult {
  passed: boolean;
  /** Onvoorwaardelijke correctheidsfouten. Blokkeren de workout altijd. */
  violations: string[];
  /**
   * Situaties die de blueprint als "harde controle" noemt, maar die hier
   * afhangen van functionaliteit die nog niet bestaat (oefening-
   * vervangflow), die de gebruiker zelf kan oplossen (RG04 bij een normale
   * training → Quick Session) of een bewust gedocumenteerde uitzondering
   * hebben (kleine oefeningenbibliotheek). Worden gemeld, blokkeren niet.
   */
  warnings: string[];
}

const ALLOWED_LEVELS: Record<string, string[]> = {
  BEGINNER: ['BEGINNER'],
  INTERMEDIATE: ['BEGINNER', 'INTERMEDIATE'],
  ADVANCED: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
};

const SESSION_DURATION_MINUTES: Record<SessionDuration, number> = {
  MIN_15: 15,
  MIN_30: 30,
  MIN_45: 45,
  MIN_60_PLUS: 60,
};

// Grove schatting: uitvoeringstijd + rust per set. Geen exacte wetenschap,
// enkel genoeg om een duidelijke mismatch te signaleren (RG04). Eén plek
// voor de schatting, zodat de Decision Engine een Quick Session met precies
// dezelfde rekensom inkort als waarmee de Rule Guard hem controleert.
const WORK_SECONDS_PER_SET = 40;
export const NORMAL_REST_SECONDS = 45;

export function estimateWorkoutSeconds(totalSets: number, restSeconds: number): number {
  return totalSets * (WORK_SECONDS_PER_SET + restSeconds);
}

/**
 * Rule Guard (CLAUDE.md Fase 3, stap 5; bron: blueprint v2.06). Geen
 * tweede Decision Engine — controleert alleen achteraf: "Mag deze
 * workout daadwerkelijk aan deze gebruiker worden gegeven?"
 * (DECISION ENGINE → WORKOUT → RULE GUARD → PASS/FAIL, v2.6.1).
 *
 * De blueprint noemt 12 controles (RG01-RG12). Niet allemaal kunnen hier
 * evenwaardig "hard falen": sommige veronderstellen functionaliteit die
 * nog niet bestaat (Quick Session voor RG04) of hebben een bewust
 * gedocumenteerde uitzondering (RG09, zie Decision Engine). Die worden
 * als waarschuwing gemeld in plaats van de gebruiker te blokkeren — dat
 * past beter bij "de gebruiker houdt controle" dan een harde crash.
 *
 * RG08 (training debt) wordt voor de weekplanning gecontroleerd in
 * `checkSchedule` (Fase 9, Smart Reschedule). RG12 (gebruikerscontrole:
 * vervangen/aanpassen/stoppen/overslaan) heeft geen zinvolle runtime-data-
 * check — dat is een UI-garantie (de gebruiker kan altijd wegnavigeren/rust
 * overslaan), geen iets wat op gegenereerde workout-data te controleren valt.
 */
@Injectable()
export class RuleGuardService {
  checkWorkout(slots: TodaysWorkoutSlot[], context: RuleGuardContext): RuleGuardResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    const allowedEquipment = new Set(['BODYWEIGHT', ...this.gymEquipmentFor(context.preferences)]);
    const allowedLevels = new Set(ALLOWED_LEVELS[context.preferences.level] ?? []);

    for (const slot of slots) {
      // RG01 — Equipment: mag de gebruiker deze apparatuur gebruiken?
      if (!allowedEquipment.has(slot.exercise.equipment)) {
        violations.push(
          `RG01: "${slot.exercise.name}" vereist ${slot.exercise.equipment}, niet beschikbaar voor deze gebruiker.`,
        );
      }

      // RG02 — Location: geen zware gym-machines voor een thuis-gebruiker.
      if (context.preferences.location === 'HOME' && slot.exercise.equipment === 'MACHINE_CABLE') {
        violations.push(`RG02: "${slot.exercise.name}" is gym-apparatuur, gebruiker traint thuis.`);
      }

      // RG03 — Level: nooit boven het toegestane niveau.
      if (!allowedLevels.has(slot.exercise.level)) {
        violations.push(
          `RG03: "${slot.exercise.name}" (${slot.exercise.level}) ligt boven het niveau van de gebruiker.`,
        );
      }

      // RG06 — Progression: geen absurde sprongen (reps altijd binnen een
      // kleine, vaste bandbreedte — zie Decision Engine repsFor()).
      if (slot.targetReps < 6 || slot.targetReps > 20) {
        violations.push(`RG06: "${slot.exercise.name}" heeft een onrealistisch repsdoel (${slot.targetReps}).`);
      }

      // RG05 — Recovery: dit movement pattern is recent zwaar belast.
      const recoveryStatus = context.recoveryByPattern.get(slot.movementPattern);
      if (recoveryStatus === 'RECOVERY') {
        warnings.push(
          `RG05: ${slot.movementPattern} staat op RECOVERY — de app kiest de lichtste variant, maar traint het patroon nog steeds.`,
        );
      }

      // RG09 — Pain: gekozen oefening zou niet opnieuw geselecteerd mogen
      // zijn na een pijnmelding. Kan alleen gebeuren als er geen enkel
      // veilig alternatief was (zie Decision Engine-fallback) — daarom
      // een waarschuwing, geen blokkade.
      if (context.decisionByChosenExercise.get(slot.exercise.id) === 'REPLACE') {
        warnings.push(
          `RG09: "${slot.exercise.name}" werd gekozen ondanks een recente pijnmelding (geen alternatief beschikbaar).`,
        );
      }
    }

    // RG07 — Volume: totaal aantal sets moet realistisch zijn voor het profiel.
    const totalSets = slots.reduce((sum, slot) => sum + slot.targetSets, 0);
    if (totalSets > 30) {
      violations.push(`RG07: totaal trainingsvolume (${totalSets} sets) is onrealistisch groot.`);
    }

    // RG08 — Training debt: nooit twee trainingen samenvoegen. Binnen één
    // workout is dit een structurele garantie: één template levert altijd
    // precies zijn eigen aantal slots op. De weekplanning (geen tweede
    // training op een dag, niets inhalen) controleert `checkSchedule`.
    if (slots.length === 0) {
      violations.push('RG08/RG11: workout bevat geen enkele trainingscomponent.');
    }

    // RG10 — Duplicate: geen dubbele oefeningen binnen dezelfde workout.
    const exerciseIds = slots.map((s) => s.exercise.id);
    if (new Set(exerciseIds).size !== exerciseIds.length) {
      violations.push('RG10: dezelfde oefening komt dubbel voor in de workout.');
    }

    // RG04 — Time: past de geschatte duur binnen de beschikbare tijd?
    if (context.timeLimit) {
      // Quick Session: harde grens, exact vergeleken (niet afgerond).
      const estimatedSeconds = estimateWorkoutSeconds(totalSets, context.timeLimit.restSeconds);
      if (estimatedSeconds > context.timeLimit.minutes * 60) {
        violations.push(
          `RG04: Quick Session (~${Math.ceil(estimatedSeconds / 60)} min) past niet binnen de gekozen ${context.timeLimit.minutes} min.`,
        );
      }
    } else {
      // Normale training: de gebruiker kan zelf voor een Quick Session
      // kiezen, dus melden we een mismatch enkel.
      const estimatedMinutes = Math.round(
        estimateWorkoutSeconds(totalSets, context.restSeconds ?? NORMAL_REST_SECONDS) / 60,
      );
      const availableMinutes = SESSION_DURATION_MINUTES[context.preferences.sessionDuration];
      if (estimatedMinutes > availableMinutes) {
        warnings.push(
          `RG04: geschatte duur (~${estimatedMinutes} min) overschrijdt de beschikbare tijd (${availableMinutes} min) — een Quick Session kan helpen.`,
        );
      }
    }

    return { passed: violations.length === 0, violations, warnings };
  }

  /**
   * Weekplanning / Smart Reschedule (CLAUDE.md Fase 9). Onafhankelijke
   * controle achteraf, niet dezelfde planningslogica opnieuw: mag deze
   * planning aan de gebruiker gegeven worden? (v2.32.12: … → DECISION ENGINE
   * → RULE GUARD → NEW SCHEDULE). Alles is hard: een schending betekent een
   * fout in de planner zelf.
   */
  checkSchedule(schedule: WeekSchedule): RuleGuardResult {
    const violations: string[] = [];
    const planned = schedule.days.filter((d) => d.status === 'PLANNED');

    // RG08 — Training debt: nooit iets "inhalen" (v2.16.6).
    const allowed = Math.max(0, schedule.weeklyTarget - schedule.completedThisWeek);
    if (planned.length > allowed) {
      violations.push(
        `RG08: ${planned.length} trainingen gepland terwijl er deze week nog maar ${allowed} passen binnen het weekdoel.`,
      );
    }
    for (const day of planned) {
      if (day.sessionCount > 0) {
        violations.push(`RG08: ${day.date} krijgt een tweede training op een dag waarop al getraind is.`);
      }
      if (day.date < schedule.today) {
        violations.push(`RG08: ${day.date} ligt in het verleden en kan niet meer gepland worden.`);
      }
    }

    // RG05 — Herstel: nooit meer trainingsdagen na elkaar dan het eigen
    // schema van de gebruiker. Alleen reeksen met een geplande dag tellen —
    // wat de gebruiker zelf al deed, is zijn keuze.
    let run = schedule.trainingDaysBeforeWeek;
    let runHasPlanned = false;
    for (const day of schedule.days) {
      if (day.status === 'DONE' || day.status === 'PLANNED') {
        run++;
        runHasPlanned ||= day.status === 'PLANNED';
        if (runHasPlanned && run > schedule.maxConsecutiveTrainingDays) {
          violations.push(
            `RG05: ${day.date} maakt ${run} trainingsdagen na elkaar (max. ${schedule.maxConsecutiveTrainingDays}).`,
          );
        }
      } else {
        run = 0;
        runHasPlanned = false;
      }
    }

    return { passed: violations.length === 0, violations, warnings: [] };
  }

  /** Wordt aangeroepen vóór het opslaan van een sessie (RG10, het andere deel). */
  assertNoDuplicateSets(sets: { exerciseId: string; setNumber: number }[]): void {
    const seen = new Set<string>();
    for (const set of sets) {
      const key = `${set.exerciseId}:${set.setNumber}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `RG10: set ${set.setNumber} voor oefening ${set.exerciseId} is dubbel aangeleverd.`,
        );
      }
      seen.add(key);
    }
  }

  private gymEquipmentFor(preferences: Pick<TrainingPreferences, 'equipment'>): string[] {
    const gym: string[] = [];
    if (preferences.equipment.includes('DUMBBELLS')) gym.push('DUMBBELL');
    if (preferences.equipment.includes('FULL_GYM')) gym.push('DUMBBELL', 'BARBELL', 'MACHINE_CABLE');
    return gym;
  }
}
