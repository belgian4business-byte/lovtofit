import type { ExperienceLevel, MovementPattern } from '../../src/generated/prisma/enums.js';

/**
 * Eén beginner full-body template, bewust simpel gehouden (CLAUDE.md Fase
 * 2, stap 2). Komt overeen met "Full Body A" uit blueprint v0.6, sectie 1:
 * squat + push + pull + hinge + core. Een template is een reeks
 * movement-pattern-slots, geen vaste oefeningen — de (latere) Decision
 * Engine vult elke slot in met een passende oefening.
 */
export const TEMPLATES: {
  name: string;
  level: ExperienceLevel;
  slots: MovementPattern[];
}[] = [
  {
    name: 'Beginner Full Body',
    level: 'BEGINNER',
    slots: ['SQUAT', 'PUSH', 'PULL', 'HINGE', 'CORE_STABILITY'],
  },
];
