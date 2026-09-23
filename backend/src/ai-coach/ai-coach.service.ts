import { Injectable } from '@nestjs/common';
import type { CalorieGoalReport } from '../calorie-goal/calorie-goal.service.js';
import type { TrendDirection } from '../body-measurements/body-measurements.service.js';
import { GoalType, type ProgressionDecision } from '../generated/prisma/enums.js';
import type { MotivationSignal, MotivationStatus } from '../motivation-engine/motivation-engine.service.js';
import type { WaterStatus } from '../water-intake/water-intake.service.js';

/**
 * AI Coach (CLAUDE.md Fase 3, stap 7; bron: blueprint v1.0 + v2.18).
 *
 * "De Engines beslissen. De AI legt uit." (v2.18.1) — deze service beslist
 * niets, hij vertaalt de al-berekende signalen (reason codes) van de
 * andere engines naar een korte, menselijke Nederlandse tekst. Bewust
 * GEEN LLM-koppeling in deze stap (zie CLAUDE.md-overleg): puur
 * template-gebaseerd op gecontroleerde input, dus per constructie:
 * - geen medische claims, geen diagnoses (v2.18.3/v2.18.14)
 * - geen verzonnen cijfers/reps/gewicht (v2.18.3)
 * - geen schuldgevoel, geen "je bent achteruitgegaan" (v1.0.7, v1.2 §13)
 * - overrult nooit een engine-beslissing, voegt enkel uitleg toe
 *
 * Momenten (v1.0.4): tijdens de training blijft minimaal (nu al gedekt
 * door de bestaande, korte UI-teksten in het workout-scherm — geen
 * engine-data nodig); hier bouwen we de twee momenten die wél
 * engine-data nodig hebben: "waarom deze training vandaag" en "hoe ging
 * de training".
 */
@Injectable()
export class AiCoachService {
  explainTodaysWorkout(input: {
    motivationSignal: MotivationSignal;
    hasRecentlyLoadedPattern: boolean;
    hadRecentReplace: boolean;
  }): string {
    // Volgorde = belangrijkste/meest urgente reden eerst.
    if (input.motivationSignal === 'RETURN_AFTER_ABSENCE') {
      return 'Welkom terug 👋 We beginnen rustig weer op.';
    }
    if (input.hadRecentReplace) {
      return 'Je gaf eerder aan dat een oefening niet lekker voelde — we hebben daarom een alternatief gekozen.';
    }
    if (input.hasRecentlyLoadedPattern) {
      return 'Je hebt de afgelopen dagen al stevig getraind, dus vandaag houden we het op die onderdelen iets lichter.';
    }
    if (input.motivationSignal === 'AT_RISK_OF_DROPOUT' || input.motivationSignal === 'CONSISTENCY_DECLINING') {
      return 'De laatste tijd lukte trainen wat minder vaak. Geen probleem — vandaag pakken we gewoon een haalbare training.';
    }
    if (input.motivationSignal === 'CONSISTENCY_GOOD') {
      return 'Je zit goed op schema deze week. Hier is je training van vandaag.';
    }
    return 'Hier is je training van vandaag.';
  }

  /**
   * Quick Session (Fase 7; v0.7.10 "minder tijd betekent niet automatisch
   * geen training", v0.8.11 "Quick Session ≠ mislukte training"). Pijn/
   * ongemak krijgt ook hier voorrang in de uitleg.
   */
  explainQuickSession(input: { estimatedMinutes: number; exerciseCount: number; hadRecentReplace: boolean }): string {
    const core = `In ongeveer ${input.estimatedMinutes} minuten doe je de ${input.exerciseCount} belangrijkste bewegingen, met kortere rust.`;
    if (input.hadRecentReplace) {
      return `${core} Een oefening die eerder niet lekker voelde, hebben we vervangen door een alternatief.`;
    }
    return `Weinig tijd vandaag? Geen probleem. ${core} Een korte training telt gewoon mee.`;
  }

  /** Premium-gate voor Quick Session (v1.1.16 + v2.19.13): waarde uitleggen, wat gratis blijft benoemen. */
  explainQuickSessionLocked(): string {
    return 'Weinig tijd? Met Premium past de app je training automatisch aan de tijd die je vandaag hebt: de belangrijkste bewegingen in 10 of 15 minuten. Je normale training blijft gewoon gratis.';
  }

  summarizeCompletedSession(input: {
    exerciseCount: number;
    setCount: number;
    hadDiscomfort: boolean;
    milestone: number | null;
    hasIncrease: boolean;
    motivationSignal: MotivationSignal;
  }): string {
    // Veiligheid krijgt altijd voorrang op motiverende taal (v2.18.14).
    if (input.hadDiscomfort) {
      return 'Je gaf aan dat een oefening ongemak veroorzaakte. Goed dat je gestopt bent — we kiezen de volgende keer een andere oefening.';
    }
    if (input.milestone !== null) {
      return `🎉 Training voltooid. Je hebt nu in totaal ${input.milestone} trainingen afgerond.`;
    }
    if (input.hasIncrease) {
      return `Training voltooid (${input.exerciseCount} oefeningen, ${input.setCount} sets). Het ging goed — volgende keer is er ruimte voor een kleine stap vooruit.`;
    }
    if (input.motivationSignal === 'CONSISTENCY_GOOD') {
      return 'Training voltooid. Je haalt je weekdoel al — goed bezig.';
    }
    return `Training voltooid: ${input.exerciseCount} oefeningen, ${input.setCount} sets.`;
  }

  /**
   * CLAUDE.md Fase 4, stap 4: per oefening uitleggen wat de Progression
   * Engine besliste voor de volgende keer. `nextReps` komt al berekend
   * binnen (decision-engine.service.ts, repsForProgressionDecision) —
   * deze service verzint zelf geen cijfers (v2.18.3), hij zet de beslissing
   * enkel om in een korte Nederlandse zin.
   */
  explainProgressionOutcome(decision: ProgressionDecision, nextReps: number): string {
    switch (decision) {
      case 'INCREASE':
        return `Ging goed — volgende keer proberen we ${nextReps} reps.`;
      case 'DECREASE':
        return `Volgende keer gaan we naar ${nextReps} reps, iets rustiger aan.`;
      case 'REPLACE':
        return 'Volgende keer kiezen we een andere oefening.';
      case 'KEEP':
      default:
        return 'Volgende keer hetzelfde — dat mag.';
    }
  }

  /**
   * CLAUDE.md Fase 4, stap 5: het huidige motivatiesignaal (Motivation
   * Engine) vertalen naar een korte Nederlandse zin voor de Progress-tab.
   * Zelfde volgordelogica als `explainTodaysWorkout` (v2.16.16), maar hier
   * losstaand van een specifieke training — dit is een algemeen
   * statusoverzicht. Mag nooit schuldgevoel opwekken (v2.16.18): ook
   * AT_RISK_OF_DROPOUT/CONSISTENCY_DECLINING worden neutraal/aanmoedigend
   * verwoord, niet als falen.
   */
  explainMotivationStatus(status: MotivationStatus): string {
    switch (status.signal) {
      case 'RETURN_AFTER_ABSENCE':
        return 'Welkom terug! Elke training telt, ook na een pauze — we bouwen rustig weer op.';
      case 'MILESTONE_REACHED':
        return `🎉 Je hebt nu ${status.milestone} trainingen afgerond!`;
      case 'CONSISTENCY_GOOD':
        return `Je zit goed op schema: ${status.completedThisWeek} van de ${status.weeklyTarget} trainingen deze week.`;
      case 'AT_RISK_OF_DROPOUT':
        return 'De laatste weken lukte trainen minder vaak. Geen zorgen — elke training die je oppakt telt weer mee.';
      case 'CONSISTENCY_DECLINING':
        return 'Het tempo zakte de laatste tijd iets. Een training deze week zet je weer op schema.';
      case 'NORMAL':
      default:
        return `Deze week: ${status.completedThisWeek} van de ${status.weeklyTarget} trainingen.`;
    }
  }

  /**
   * CLAUDE.md Fase 5, stap 2 (bron: blueprint v1.3 §6 / v2.17.4 + v2.17.12).
   * De Trend Engine (body-measurements.service.ts) berekent de richting;
   * deze methode zet dat om in dezelfde soort geruststellende zin die de
   * blueprint zelf als voorbeeld geeft — dagelijkse schommeling wordt nooit
   * als een op-zichzelf-staand feit gepresenteerd.
   */
  explainWeightTrend(status: 'INSUFFICIENT_DATA' | 'HAS_TREND', direction: TrendDirection | null): string {
    if (status === 'INSUFFICIENT_DATA') {
      return 'We hebben nog niet genoeg metingen voor een betrouwbare trend. Blijf gewoon af en toe wegen — na een paar metingen kunnen we een trend laten zien.';
    }
    switch (direction) {
      case 'DOWN':
        return 'Je gewicht schommelt van dag tot dag, maar de trend van de laatste metingen beweegt geleidelijk naar beneden.';
      case 'UP':
        return 'Je gewicht schommelt van dag tot dag, maar de trend van de laatste metingen beweegt geleidelijk omhoog.';
      case 'STABLE':
      default:
        return 'Je gewicht is de laatste tijd redelijk stabiel.';
    }
  }

  /**
   * CLAUDE.md Fase 5, stap 3 (bron: blueprint v1.3 §10 / v2.17.7). Het
   * waterdoel is zelf al een richtwaarde, geen medische norm — deze
   * methode rondt het restant af (geen schijnprecisie zoals "487 ml") en
   * gebruikt exact de geruststellende toonzetting uit het blueprint-
   * voorbeeld ("nog ongeveer 500 ml te gaan").
   */
  explainWaterStatus(status: WaterStatus): string {
    if (status.remainingMl <= 0) {
      return 'Je hebt je waterdoel voor vandaag gehaald 💧';
    }
    const roundedRemaining = Math.ceil(status.remainingMl / 50) * 50;
    return `Je hebt vandaag nog ongeveer ${roundedRemaining} ml te gaan.`;
  }

  /**
   * CLAUDE.md Fase 5, stap 4 (bron: blueprint v1.3 §4 + v2.17.16). Nooit
   * één "magisch getal" (v1.3 §4) — de range komt al berekend binnen
   * (calorie-goal.service.ts), deze methode zet dat enkel om in tekst.
   */
  explainCalorieGoal(report: CalorieGoalReport): string {
    if (report.status === 'LIMITED_ESTIMATE') {
      return 'We hebben nog geen gewicht geregistreerd om een calorie-richtwaarde te berekenen. Log je gewicht om deze te zien.';
    }
    if (report.status === 'NOT_APPLICABLE') {
      return '';
    }
    // Premium-gate zonder "ACCESS DENIED" (v2.19.13): leg de waarde uit en
    // benadruk wat gratis blijft.
    if (report.status === 'PREMIUM_REQUIRED') {
      return 'Met Premium krijg je een persoonlijke calorie-richtwaarde als range, afgestemd op je doel en je gewicht. Je gewicht en water bijhouden blijft gewoon gratis.';
    }
    const range = `${report.rangeLowKcal}–${report.rangeHighKcal} kcal per dag`;
    if (report.goalType === GoalType.LOSE_WEIGHT) {
      return `Om rustig richting je doel te gaan, kun je starten rond ${range}.`;
    }
    return `Voor het opbouwen van spiermassa kun je richten op ongeveer ${range}, met voldoende eiwit.`;
  }
}
