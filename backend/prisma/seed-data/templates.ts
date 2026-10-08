import type { ExperienceLevel, MovementPattern } from '../../src/generated/prisma/enums.js';

/**
 * Eén beginner full-body template, bewust simpel gehouden (CLAUDE.md Fase
 * 2, stap 2). Komt overeen met "Full Body A" uit blueprint v0.6, sectie 1:
 * squat + push + pull + hinge + core. Een template is een reeks
 * movement-pattern-slots, geen vaste oefeningen — de (latere) Decision
 * Engine vult elke slot in met een passende oefening.
 *
 * Fase 12: rond het hoofddeel (`slots`) een warming-up (lichte cardio +
 * mobiliteit) en een cooldown (2× mobiliteit/stretch), elk 2 oefeningen.
 */
export const TEMPLATES: {
  name: string;
  level: ExperienceLevel;
  warmup: MovementPattern[];
  slots: MovementPattern[];
  cooldown: MovementPattern[];
}[] = [
  {
    name: 'Beginner Full Body',
    level: 'BEGINNER',
    warmup: ['CARDIO', 'MOBILITY'],
    slots: ['SQUAT', 'PUSH', 'PULL', 'HINGE', 'CORE_STABILITY'],
    cooldown: ['MOBILITY', 'MOBILITY'],
  },
];
