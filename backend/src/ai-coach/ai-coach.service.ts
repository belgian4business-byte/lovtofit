import { Injectable } from '@nestjs/common';
import type { MotivationSignal } from '../motivation-engine/motivation-engine.service.js';

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
}
