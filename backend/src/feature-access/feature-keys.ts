import { SubscriptionPlan } from '../generated/prisma/enums.js';

// Eén centrale lijst van alle functies (CLAUDE.md: `CAN_USE_*` via de
// FeatureAccessService, niet `if premium` verspreid door de code). Deze lijst
// is de bron voor de seed (tabellen `features` + `plan_features`), zodat code
// en database dezelfde sleutels gebruiken.
//
// FREE moet zelfstandig bruikbaar blijven (blueprint v1.1.15/v2.19.4): alles
// wat vandaag gratis werkt, blijft gratis. Alleen de caloriedoel-range gaat
// nu achter Premium (in Fase 5 stap 4 bewust uitgesteld). De overige
// Premium-functies bestaan nog niet in de app, maar staan er alvast in zodat
// ze later alleen nog gekoppeld hoeven te worden.
export const FEATURES = {
  // FREE (+ PREMIUM)
  CAN_USE_BASIC_WORKOUT: { description: 'Training van vandaag, loggen en afronden', plans: ['FREE', 'PREMIUM'] },
  CAN_USE_HISTORY: { description: 'Trainingsgeschiedenis en basisprogressie', plans: ['FREE', 'PREMIUM'] },
  CAN_USE_COACH_MESSAGES: { description: 'Korte uitleg van de coach bij je training', plans: ['FREE', 'PREMIUM'] },
  CAN_USE_WEIGHT_TRACKING: { description: 'Gewicht bijhouden en gewichtstrend', plans: ['FREE', 'PREMIUM'] },
  CAN_USE_WATER_TRACKING: { description: 'Water bijhouden met richtwaarde', plans: ['FREE', 'PREMIUM'] },
  // PREMIUM
  CAN_USE_CALORIE_RANGE: { description: 'Persoonlijk caloriedoel als range', plans: ['PREMIUM'] },
  CAN_USE_DYNAMIC_PLANNER: { description: 'Dynamische weekplanning', plans: ['PREMIUM'] },
  CAN_USE_SMART_RESCHEDULE: { description: 'Automatisch herplannen na een gemiste training', plans: ['PREMIUM'] },
  CAN_USE_QUICK_SESSION: { description: 'Training aanpassen aan de tijd die je vandaag hebt', plans: ['PREMIUM'] },
  CAN_USE_ADVANCED_PROGRESS: { description: 'Gedetailleerde progressieanalyse', plans: ['PREMIUM'] },
  CAN_USE_WEEKLY_COACH_REVIEW: { description: 'Persoonlijke weekanalyse van de coach', plans: ['PREMIUM'] },
} as const satisfies Record<string, { description: string; plans: readonly SubscriptionPlan[] }>;

export type FeatureKey = keyof typeof FEATURES;
