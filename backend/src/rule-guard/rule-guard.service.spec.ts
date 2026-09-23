import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { DayStatus, WeekSchedule } from '../schedule/week-schedule.js';
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

  describe('checkSchedule (Fase 9, Smart Reschedule)', () => {
    // Week ma 21 t/m zo 27 september 2026, vandaag = donderdag.
    function schedule(statuses: DayStatus[], overrides: Partial<WeekSchedule> = {}): WeekSchedule {
      const days = statuses.map((status, i) => ({
        date: `2026-09-${21 + i}`,
        weekday: (['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const)[i],
        status,
        isToday: i === 3,
        sessionCount: status === 'DONE' ? 1 : 0,
      }));
      return {
        weekStart: '2026-09-21',
        today: '2026-09-24',
        weeklyTarget: 3,
        plannedWeekdays: ['MON', 'WED', 'FRI'],
        maxConsecutiveTrainingDays: 1,
        completedThisWeek: days.filter((d) => d.status === 'DONE').length,
        missedCount: 0,
        remainingThisWeek: 0,
        droppedTrainings: 0,
        smartReschedule: 'APPLIED',
        trainingDaysBeforeWeek: 0,
        days,
        ...overrides,
      };
    }

    it('laat een goede herplanning door', () => {
      const result = service.checkSchedule(schedule(['DONE', 'REST', 'MISSED', 'PLANNED', 'REST', 'PLANNED', 'REST']));

      expect(result.passed).toBe(true);
    });

    it('RG08: blokkeert inhalen (meer trainingen dan het weekdoel toelaat)', () => {
      const result = service.checkSchedule(schedule(['DONE', 'REST', 'MISSED', 'PLANNED', 'REST', 'PLANNED', 'PLANNED']));

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.startsWith('RG08'))).toBe(true);
    });

    it('RG08: blokkeert een tweede training op een dag waarop al getraind is', () => {
      const s = schedule(['DONE', 'REST', 'MISSED', 'PLANNED', 'REST', 'REST', 'REST']);
      s.days[3].sessionCount = 1;

      expect(service.checkSchedule(s).violations.some((v) => v.includes('tweede training'))).toBe(true);
    });

    it('RG08: blokkeert een geplande dag in het verleden', () => {
      const result = service.checkSchedule(schedule(['DONE', 'PLANNED', 'REST', 'REST', 'REST', 'REST', 'REST']));

      expect(result.violations.some((v) => v.includes('verleden'))).toBe(true);
    });

    it('RG05: blokkeert meer trainingsdagen na elkaar dan het eigen schema', () => {
      const result = service.checkSchedule(schedule(['DONE', 'REST', 'DONE', 'PLANNED', 'REST', 'REST', 'REST']));
      const acrossWeek = service.checkSchedule(
        schedule(['PLANNED', 'REST', 'REST', 'REST', 'REST', 'REST', 'REST'], { today: '2026-09-21', trainingDaysBeforeWeek: 1 }),
      );

      expect(result.violations.some((v) => v.startsWith('RG05'))).toBe(true);
      expect(acrossWeek.violations.some((v) => v.startsWith('RG05'))).toBe(true);
    });

    it('RG05: wat de gebruiker zelf na elkaar deed, is zijn keuze', () => {
      const result = service.checkSchedule(schedule(['DONE', 'DONE', 'DONE', 'REST', 'REST', 'REST', 'REST']));

      expect(result.passed).toBe(true);
    });
  });
});
