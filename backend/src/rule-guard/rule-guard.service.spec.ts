import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RuleGuardService } from './rule-guard.service.js';

describe('RuleGuardService', () => {
  const service = new RuleGuardService();

  const baseSlot = {
    order: 0,
    movementPattern: 'SQUAT' as const,
    targetSets: 3,
    targetReps: 12,
    exercise: {
      id: 'ex-1',
      name: 'Bodyweight Squat',
      muscleGroup: 'LEGS_GLUTES',
      equipment: 'BODYWEIGHT',
      level: 'BEGINNER',
    },
  };

  const basePreferences = {
    location: 'HOME' as const,
    equipment: ['NONE'] as const,
    level: 'BEGINNER' as const,
    sessionDuration: 'MIN_60_PLUS' as const,
  };

  function context(overrides: Partial<typeof basePreferences> = {}) {
    return {
      preferences: { ...basePreferences, ...overrides } as never,
      recoveryByPattern: new Map(),
      decisionByChosenExercise: new Map(),
    };
  }

  it('geeft PASS voor een veilige, passende workout', () => {
    const result = service.checkWorkout([baseSlot], context());

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('RG01: blokkeert apparatuur die de gebruiker niet heeft', () => {
    const slot = { ...baseSlot, exercise: { ...baseSlot.exercise, equipment: 'DUMBBELL' } };

    const result = service.checkWorkout([slot], context());

    expect(result.passed).toBe(false);
    expect(result.violations[0]).toMatch(/^RG01/);
  });

  it('RG02: blokkeert gym-machines voor een thuis-trainende gebruiker', () => {
    const slot = { ...baseSlot, exercise: { ...baseSlot.exercise, equipment: 'MACHINE_CABLE' } };

    const result = service.checkWorkout(
      [slot],
      context({ equipment: ['FULL_GYM'] as never }),
    );

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.startsWith('RG02'))).toBe(true);
  });

  it('RG03: blokkeert een oefening boven het toegestane niveau', () => {
    const slot = { ...baseSlot, exercise: { ...baseSlot.exercise, level: 'ADVANCED' } };

    const result = service.checkWorkout([slot], context());

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.startsWith('RG03'))).toBe(true);
  });

  it('RG06: blokkeert een onrealistisch repsdoel', () => {
    const slot = { ...baseSlot, targetReps: 45 };

    const result = service.checkWorkout([slot], context());

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.startsWith('RG06'))).toBe(true);
  });

  it('RG10: blokkeert dezelfde oefening dubbel in één workout', () => {
    const result = service.checkWorkout([baseSlot, { ...baseSlot, order: 1 }], context());

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.startsWith('RG10'))).toBe(true);
  });

  it('RG05: meldt (waarschuwing, geen blokkade) als een movement pattern op RECOVERY staat', () => {
    const ctx = context();
    ctx.recoveryByPattern.set('SQUAT', 'RECOVERY');

    const result = service.checkWorkout([baseSlot], ctx);

    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.startsWith('RG05'))).toBe(true);
  });

  it('RG09: meldt (waarschuwing, geen blokkade) als de gekozen oefening ondanks REPLACE gekozen werd', () => {
    const ctx = context();
    ctx.decisionByChosenExercise.set('ex-1', 'REPLACE');

    const result = service.checkWorkout([baseSlot], ctx);

    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.startsWith('RG09'))).toBe(true);
  });

  it('RG04: meldt (waarschuwing) als de geschatte duur de beschikbare tijd overschrijdt', () => {
    const slots = Array.from({ length: 5 }, (_, i) => ({ ...baseSlot, order: i, exercise: { ...baseSlot.exercise, id: `ex-${i}` } }));

    const result = service.checkWorkout(slots, context({ sessionDuration: 'MIN_15' as never }));

    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.startsWith('RG04'))).toBe(true);
  });

  describe('assertNoDuplicateSets (RG10)', () => {
    it('gooit een BadRequestException bij een dubbele set', () => {
      expect(() =>
        service.assertNoDuplicateSets([
          { exerciseId: 'ex-1', setNumber: 1 },
          { exerciseId: 'ex-1', setNumber: 1 },
        ]),
      ).toThrow(BadRequestException);
    });

    it('accepteert unieke sets', () => {
      expect(() =>
        service.assertNoDuplicateSets([
          { exerciseId: 'ex-1', setNumber: 1 },
          { exerciseId: 'ex-1', setNumber: 2 },
        ]),
      ).not.toThrow();
    });
  });

  describe('RG04 bij een Quick Session (harde tijdsgrens, v2.5.4)', () => {
    it('blokkeert een Quick Session die niet binnen de gekozen tijd past', () => {
      // 10 sets × (40s + 30s) = 700s > 10 min.
      const slots = Array.from({ length: 5 }, (_, i) => ({
        ...baseSlot,
        targetSets: 2,
        exercise: { ...baseSlot.exercise, id: `ex-${i}` },
      }));

      const result = service.checkWorkout(slots, { ...context(), timeLimit: { minutes: 10, restSeconds: 30 } });

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.startsWith('RG04'))).toBe(true);
      expect(result.warnings.some((w) => w.startsWith('RG04'))).toBe(false);
    });

    it('laat een Quick Session door die precies binnen de tijd past', () => {
      // 8 sets × 70s = 560s ≤ 600s.
      const slots = Array.from({ length: 4 }, (_, i) => ({
        ...baseSlot,
        targetSets: 2,
        exercise: { ...baseSlot.exercise, id: `ex-${i}` },
      }));

      const result = service.checkWorkout(slots, { ...context(), timeLimit: { minutes: 10, restSeconds: 30 } });

      expect(result.passed).toBe(true);
    });
  });
});
