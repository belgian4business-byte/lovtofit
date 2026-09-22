import { BadRequestException, Injectable } from '@nestjs/common';
import type { TrainingPreferences } from '../generated/prisma/client.js';
import type { ProgressionDecision, SessionDuration } from '../generated/prisma/enums.js';
import type { TodaysWorkoutSlot } from '../decision-engine/decision-engine.service.js';
import type { RecoveryStatus } from '../recovery-engine/recovery-engine.service.js';

export interface RuleGuardContext {
  preferences: Pick<TrainingPreferences, 'location' | 'equipment' | 'level' | 'sessionDuration'>;
  recoveryByPattern: Map<string, RecoveryStatus>;
  decisionByChosenExercise: Map<string, ProgressionDecision | undefined>;
}

export interface RuleGuardResult {
  passed: boolean;
  /** Onvoorwaardelijke correctheidsfouten. Blokkeren de workout altijd. */
  violations: string[];
  /**
   * Situaties die de blueprint als "harde controle" noemt, maar die hier
   * afhangen van functionaliteit die nog niet bestaat (Quick Session,
   * oefening-vervangflow) of een bewust gedocumenteerde uitzondering
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
// enkel genoeg om een duidelijke mismatch te signaleren (RG04).
const SECONDS_PER_SET = 40 + 45;

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
 * RG08 (training debt) en RG12 (gebruikerscontrole: vervangen/aanpassen/
 * stoppen/overslaan) hebben geen zinvolle runtime-data-check in onze
 * huidige app — er bestaat nog geen weekplanning/gemiste-training-
 * herplanning die training debt zou kunnen veroorzaken, en
 * gebruikerscontrole is een UI-garantie (de gebruiker kan altijd
 * wegnavigeren/rust overslaan), geen iets wat op gegenereerde
 * workout-data te controleren valt.
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

    // RG08 — Training debt: nooit twee trainingen samenvoegen. Er bestaat
    // nog geen weekplanning/inhaalflow die dit zou kunnen veroorzaken, dus
    // dit is nu een structurele garantie: één template levert altijd
    // precies zijn eigen aantal slots op.
    if (slots.length === 0) {
      violations.push('RG08/RG11: workout bevat geen enkele trainingscomponent.');
    }

    // RG10 — Duplicate: geen dubbele oefeningen binnen dezelfde workout.
    const exerciseIds = slots.map((s) => s.exercise.id);
    if (new Set(exerciseIds).size !== exerciseIds.length) {
      violations.push('RG10: dezelfde oefening komt dubbel voor in de workout.');
    }

    // RG04 — Time: past de geschatte duur binnen de beschikbare tijd?
    // Zonder Quick Session kunnen we een mismatch nog niet oplossen, dus
    // melden we het enkel.
    const estimatedMinutes = Math.round(
      (totalSets * SECONDS_PER_SET) / 60,
    );
    const availableMinutes = SESSION_DURATION_MINUTES[context.preferences.sessionDuration];
    if (estimatedMinutes > availableMinutes) {
      warnings.push(
        `RG04: geschatte duur (~${estimatedMinutes} min) overschrijdt de beschikbare tijd (${availableMinutes} min) — Quick Session bestaat nog niet.`,
      );
    }

    return { passed: violations.length === 0, violations, warnings };
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
