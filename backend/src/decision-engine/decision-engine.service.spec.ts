import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCoachService } from '../ai-coach/ai-coach.service.js';
import { RuleGuardService } from '../rule-guard/rule-guard.service.js';
import {
  applyLightSession,
  DecisionEngineService,
  planQuickSession,
  QUICK_SESSION_MINUTE_OPTIONS,
  type QuickSession,
} from './decision-engine.service.js';

const NORMAL_MOTIVATION = {
  signal: 'NORMAL',
  consistencyStreakWeeks: 0,
  weeklyTarget: 3,
  completedThisWeek: 0,
  totalSessionsCompleted: 0,
  milestone: null,
  daysSinceLastSession: null,
};

const NORMAL_RECOVERY = {
  byMovementPattern: [
    { key: 'SQUAT', status: 'NORMAL', loadScore: 0 },
    { key: 'PUSH', status: 'NORMAL', loadScore: 0 },
  ],
  byMuscleGroup: [],
};

describe('DecisionEngineService', () => {
  let prisma: {
    trainingPreferences: { findUnique: ReturnType<typeof vi.fn> };
    workoutTemplate: { findMany: ReturnType<typeof vi.fn> };
    exercise: { findMany: ReturnType<typeof vi.fn> };
    exerciseProgression: { findMany: ReturnType<typeof vi.fn> };
    workoutSession: { findFirst: ReturnType<typeof vi.fn> };
  };
  let recoveryEngine: { getStatus: ReturnType<typeof vi.fn> };
  let motivationEngine: { getStatus: ReturnType<typeof vi.fn> };
  let featureAccess: { canUse: ReturnType<typeof vi.fn> };
  let service: DecisionEngineService;

  const template = {
    id: 'template-1',
    name: 'Beginner Full Body',
    level: 'BEGINNER',
    slots: [
      { order: 0, movementPattern: 'SQUAT' },
      { order: 1, movementPattern: 'PUSH' },
    ],
  };

  function exercise(overrides: Record<string, string>): Record<string, string> {
    return {
      id: 'ex',
      muscleGroup: 'LEGS_GLUTES',
      equipment: 'BODYWEIGHT',
      level: 'BEGINNER',
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      trainingPreferences: { findUnique: vi.fn() },
      workoutTemplate: { findMany: vi.fn().mockResolvedValue([template]) },
      exercise: { findMany: vi.fn().mockResolvedValue([]) },
      exerciseProgression: { findMany: vi.fn().mockResolvedValue([]) },
      workoutSession: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    recoveryEngine = { getStatus: vi.fn().mockResolvedValue(NORMAL_RECOVERY) };
    motivationEngine = { getStatus: vi.fn().mockResolvedValue(NORMAL_MOTIVATION) };
    // Standaard Premium; de FREE-situatie wordt apart getest.
    featureAccess = { canUse: vi.fn().mockResolvedValue(true) };
    service = new DecisionEngineService(
      prisma as never,
      recoveryEngine as never,
      new RuleGuardService(),
      motivationEngine as never,
      new AiCoachService(),
      featureAccess as never,
    );
  });

  it('gooit een NotFoundException als de onboarding nog niet is afgerond', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue(null);

    await expect(service.getTodaysWorkout('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('gooit een NotFoundException als er geen oefening past bij een slot', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ level: 'BEGINNER', equipment: ['NONE'] });
    prisma.exercise.findMany.mockResolvedValue([]);

    await expect(service.getTodaysWorkout('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sluit (veiligheid eerst) oefeningen boven het niveau van de gebruiker hard uit', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ level: 'BEGINNER', equipment: ['NONE'] });
    prisma.exercise.findMany.mockImplementation(({ where }: { where: { movementPattern: string; level: { in: string[] } } }) =>
      Promise.resolve(
        [
          exercise({ id: 'squat-beginner', name: 'Bodyweight Squat', movementPattern: 'SQUAT', level: 'BEGINNER' }),
          exercise({ id: 'squat-intermediate', name: 'Goblet Squat', movementPattern: 'SQUAT', level: 'INTERMEDIATE' }),
          exercise({ id: 'push-intermediate', name: 'Push-up', movementPattern: 'PUSH', level: 'INTERMEDIATE' }),
        ].filter((e) => e.movementPattern === where.movementPattern && where.level.in.includes(e.level)),
      ),
    );

    // PUSH heeft voor een beginner geen enkele geschikte kandidaat meer.
    await expect(service.getTodaysWorkout('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sluit een oefening uit die recent op pijn/ongemak is gestopt (REPLACE), zolang er een alternatief is', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ level: 'BEGINNER', equipment: ['NONE'] });
    prisma.exercise.findMany.mockImplementation(({ where }: { where: { movementPattern: string } }) => {
      if (where.movementPattern === 'PUSH') {
        return Promise.resolve([
          exercise({ id: 'wall', name: 'Wall Push-up', movementPattern: 'PUSH' }),
          exercise({ id: 'knee', name: 'Knee Push-up', movementPattern: 'PUSH' }),
        ]);
      }
      return Promise.resolve([exercise({ id: 'squat', name: 'Bodyweight Squat', movementPattern: 'SQUAT' })]);
    });
    prisma.exerciseProgression.findMany.mockResolvedValue([
      { exerciseId: 'wall', decision: 'REPLACE' },
    ]);

    const result = await service.getTodaysWorkout('user-1');

    const push = result.slots.find((s) => s.movementPattern === 'PUSH')!;
    expect(push.exercise.id).toBe('knee');
  });

  it('geeft voorrang aan dezelfde oefening als de vorige keer (continuïteit)', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ level: 'BEGINNER', equipment: ['NONE'] });
    prisma.exercise.findMany.mockImplementation(({ where }: { where: { movementPattern: string } }) => {
      if (where.movementPattern === 'PUSH') {
        return Promise.resolve([
          exercise({ id: 'wall', name: 'Wall Push-up', movementPattern: 'PUSH' }),
          exercise({ id: 'knee', name: 'Knee Push-up', movementPattern: 'PUSH' }),
        ]);
      }
      return Promise.resolve([exercise({ id: 'squat', name: 'Bodyweight Squat', movementPattern: 'SQUAT' })]);
    });
    prisma.workoutSession.findFirst.mockResolvedValue({
      loggedSets: [{ exerciseId: 'wall', exercise: { movementPattern: 'PUSH' } }],
    });

    const result = await service.getTodaysWorkout('user-1');

    const push = result.slots.find((s) => s.movementPattern === 'PUSH')!;
    expect(push.exercise.id).toBe('wall');
  });

  it('verhoogt de reps bij een INCREASE-beslissing en verlaagt ze bij DECREASE', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ level: 'BEGINNER', equipment: ['NONE'] });
    prisma.exercise.findMany.mockImplementation(({ where }: { where: { movementPattern: string } }) =>
      Promise.resolve([
        exercise({
          id: where.movementPattern === 'SQUAT' ? 'squat' : 'push',
          name: where.movementPattern,
          movementPattern: where.movementPattern,
        }),
      ]),
    );
    prisma.exerciseProgression.findMany.mockResolvedValue([
      { exerciseId: 'squat', decision: 'INCREASE' },
      { exerciseId: 'push', decision: 'DECREASE' },
    ]);

    const result = await service.getTodaysWorkout('user-1');

    expect(result.slots.find((s) => s.movementPattern === 'SQUAT')!.targetReps).toBe(14);
    expect(result.slots.find((s) => s.movementPattern === 'PUSH')!.targetReps).toBe(10);
  });

  it('geeft voorrang aan de lichtste variant als het movement pattern recent belast is', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ level: 'INTERMEDIATE', equipment: ['NONE'] });
    prisma.exercise.findMany.mockImplementation(({ where }: { where: { movementPattern: string } }) => {
      if (where.movementPattern === 'PUSH') {
        return Promise.resolve([
          exercise({ id: 'wall', name: 'Wall Push-up', movementPattern: 'PUSH', level: 'BEGINNER' }),
          exercise({ id: 'pushup', name: 'Push-up', movementPattern: 'PUSH', level: 'INTERMEDIATE' }),
        ]);
      }
      return Promise.resolve([exercise({ id: 'squat', name: 'Bodyweight Squat', movementPattern: 'SQUAT' })]);
    });
    recoveryEngine.getStatus.mockResolvedValue({
      byMovementPattern: [
        { key: 'SQUAT', status: 'NORMAL', loadScore: 0 },
        { key: 'PUSH', status: 'RECOVERY', loadScore: 80 },
      ],
      byMuscleGroup: [],
    });

    const result = await service.getTodaysWorkout('user-1');

    const push = result.slots.find((s) => s.movementPattern === 'PUSH')!;
    expect(push.exercise.id).toBe('wall');
  });

  it('Rule Guard blokkeert onafhankelijk een workout die eigenlijk al uitgefilterd had moeten zijn', async () => {
    // Simuleert een hypothetische bug in de query hierboven: een oefening
    // boven het toegestane niveau komt toch terug. Rule Guard is een
    // aparte, onafhankelijke controle en moet dit zelf ook vangen.
    prisma.trainingPreferences.findUnique.mockResolvedValue({ level: 'BEGINNER', equipment: ['NONE'] });
    prisma.exercise.findMany.mockImplementation(({ where }: { where: { movementPattern: string } }) =>
      Promise.resolve([
        exercise({
          id: 'ex',
          name: where.movementPattern,
          movementPattern: where.movementPattern,
          level: 'ADVANCED', // hoort niet toegestaan te zijn voor een beginner
        }),
      ]),
    );

    await expect(service.getTodaysWorkout('user-1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('geeft de Rule Guard-waarschuwing (RG05) mee in de response als een movement pattern op RECOVERY staat', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ level: 'INTERMEDIATE', equipment: ['NONE'] });
    prisma.exercise.findMany.mockImplementation(({ where }: { where: { movementPattern: string } }) => {
      if (where.movementPattern === 'PUSH') {
        return Promise.resolve([
          exercise({ id: 'wall', name: 'Wall Push-up', movementPattern: 'PUSH', level: 'BEGINNER' }),
        ]);
      }
      return Promise.resolve([exercise({ id: 'squat', name: 'Bodyweight Squat', movementPattern: 'SQUAT' })]);
    });
    recoveryEngine.getStatus.mockResolvedValue({
      byMovementPattern: [
        { key: 'SQUAT', status: 'NORMAL', loadScore: 0 },
        { key: 'PUSH', status: 'RECOVERY', loadScore: 80 },
      ],
      byMuscleGroup: [],
    });

    const result = await service.getTodaysWorkout('user-1');

    expect(result.ruleGuardWarnings.some((w) => w.startsWith('RG05'))).toBe(true);
  });

  it('geeft een AI Coach-boodschap mee die het "welkom terug"-signaal van de Motivation Engine vertaalt', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ level: 'BEGINNER', equipment: ['NONE'] });
    prisma.exercise.findMany.mockImplementation(({ where }: { where: { movementPattern: string } }) =>
      Promise.resolve([
        exercise({ id: `ex-${where.movementPattern}`, name: where.movementPattern, movementPattern: where.movementPattern }),
      ]),
    );
    motivationEngine.getStatus.mockResolvedValue({ ...NORMAL_MOTIVATION, signal: 'RETURN_AFTER_ABSENCE' });

    const result = await service.getTodaysWorkout('user-1');

    expect(result.coachMessage).toBe('Welkom terug 👋 We beginnen rustig weer op.');
  });

  describe('energie-check (Fase 8)', () => {
    beforeEach(() => {
      prisma.trainingPreferences.findUnique.mockResolvedValue({
        level: 'INTERMEDIATE',
        equipment: ['NONE'],
        location: 'HOME',
        sessionDuration: 'MIN_45',
      });
      prisma.exercise.findMany.mockImplementation(({ where }: { where: { movementPattern: string } }) =>
        Promise.resolve([
          exercise({ id: `${where.movementPattern}-beginner`, name: `A ${where.movementPattern}`, movementPattern: where.movementPattern, level: 'BEGINNER' }),
          exercise({ id: `${where.movementPattern}-intermediate`, name: `B ${where.movementPattern}`, movementPattern: where.movementPattern, level: 'INTERMEDIATE' }),
        ]),
      );
    });

    it('LOW: Light Session — 2 sets, 2 reps minder, langere rust, lichtste variant', async () => {
      const result = await service.getTodaysWorkout('user-1', 'LOW');

      expect(result.slots.every((s) => s.targetSets === 2 && s.targetReps === 10)).toBe(true);
      expect(result.slots.every((s) => s.exercise.level === 'BEGINNER')).toBe(true);
      expect(result).toMatchObject({ energyLevel: 'LOW', energyAdjusted: true, restSeconds: 60 });
      expect(result.coachMessage).toContain('lichter');
    });

    it('NORMAL, HIGH of overgeslagen: gewoon de normale training (hoge energie ≠ meer volume)', async () => {
      for (const energy of ['NORMAL', 'HIGH', undefined] as const) {
        const result = await service.getTodaysWorkout('user-1', energy);

        expect(result.slots.every((s) => s.targetSets === 3 && s.targetReps === 12)).toBe(true);
        expect(result.slots.every((s) => s.exercise.level === 'INTERMEDIATE')).toBe(true);
        expect(result).toMatchObject({ energyLevel: energy ?? null, energyAdjusted: false, restSeconds: 45 });
      }
    });

    it('LOW overrulet nooit de veiligheid: een oefening na een pijnmelding blijft uitgesloten', async () => {
      prisma.exerciseProgression.findMany.mockResolvedValue([{ exerciseId: 'PUSH-beginner', decision: 'REPLACE' }]);

      const result = await service.getTodaysWorkout('user-1', 'LOW');

      expect(result.slots.find((s) => s.movementPattern === 'PUSH')?.exercise.id).toBe('PUSH-intermediate');
    });
  });

  describe('getQuickSession (Fase 7)', () => {
    const fullTemplate = {
      ...template,
      slots: ['SQUAT', 'PUSH', 'PULL', 'HINGE', 'CORE_STABILITY'].map((movementPattern, order) => ({
        order,
        movementPattern,
      })),
    };

    const quick = async (minutes: number) => (await service.getQuickSession('user-1', minutes)) as QuickSession;

    beforeEach(() => {
      prisma.workoutTemplate.findMany.mockResolvedValue([fullTemplate]);
      prisma.trainingPreferences.findUnique.mockResolvedValue({
        level: 'BEGINNER',
        equipment: ['NONE'],
        location: 'HOME',
        sessionDuration: 'MIN_45',
      });
      prisma.exercise.findMany.mockImplementation(({ where }: { where: { movementPattern: string } }) =>
        Promise.resolve([
          exercise({ id: `ex-${where.movementPattern}`, name: where.movementPattern, movementPattern: where.movementPattern }),
        ]),
      );
    });

    it('FA-002: FREE-gebruiker krijgt PREMIUM_REQUIRED en er wordt niets berekend', async () => {
      featureAccess.canUse.mockResolvedValue(false);

      const result = await service.getQuickSession('user-1', 10);

      expect(featureAccess.canUse).toHaveBeenCalledWith('user-1', 'CAN_USE_QUICK_SESSION');
      expect(result.status).toBe('PREMIUM_REQUIRED');
      expect(result).not.toHaveProperty('slots');
      expect(result.coachMessage).toContain('Premium');
      expect(prisma.trainingPreferences.findUnique).not.toHaveBeenCalled();
    });

    it('10 min: 4 belangrijkste bewegingen × 2 sets, binnen de tijd, hinge valt af', async () => {
      const result = await quick(10);

      expect(result.slots.map((s) => s.movementPattern)).toEqual(['SQUAT', 'PUSH', 'PULL', 'CORE_STABILITY']);
      expect(result.slots.every((s) => s.targetSets === 2)).toBe(true);
      expect(result.slots.map((s) => s.order)).toEqual([0, 1, 2, 3]);
      // 8 sets × (40s + 30s rust) = 560s ≈ 10 min, nooit erboven.
      expect(result.estimatedMinutes).toBeLessThanOrEqual(10);
      expect(result).toMatchObject({ status: 'AVAILABLE', sessionType: 'QUICK', availableMinutes: 10, restSeconds: 30 });
      expect(result.coachMessage).toContain('telt gewoon mee');
    });

    it('15 min: 4 bewegingen × 3 sets (meer tijd = meer volume, niet meer oefeningen)', async () => {
      const result = await quick(15);

      expect(result.slots).toHaveLength(4);
      expect(result.slots.every((s) => s.targetSets === 3)).toBe(true);
      expect(result.estimatedMinutes).toBeLessThanOrEqual(15);
    });

    it('gebruikt dezelfde veiligheidsregels als de normale training (REPLACE wordt vervangen)', async () => {
      prisma.exercise.findMany.mockImplementation(({ where }: { where: { movementPattern: string } }) => {
        if (where.movementPattern === 'PUSH') {
          return Promise.resolve([
            exercise({ id: 'push-painful', name: 'A Push-up', movementPattern: 'PUSH' }),
            exercise({ id: 'push-safe', name: 'B Incline Push-up', movementPattern: 'PUSH' }),
          ]);
        }
        return Promise.resolve([
          exercise({ id: `ex-${where.movementPattern}`, name: where.movementPattern, movementPattern: where.movementPattern }),
        ]);
      });
      prisma.exerciseProgression.findMany.mockResolvedValue([{ exerciseId: 'push-painful', decision: 'REPLACE' }]);

      const result = await quick(10);

      expect(result.slots.find((s) => s.movementPattern === 'PUSH')?.exercise.id).toBe('push-safe');
    });

    it('schuift een patroon op RECOVERY naar achteren, zodat het bij weinig tijd als eerste afvalt', async () => {
      recoveryEngine.getStatus.mockResolvedValue({
        byMovementPattern: [{ key: 'SQUAT', status: 'RECOVERY', loadScore: 99 }],
        byMuscleGroup: [],
      });

      const result = await quick(10);

      expect(result.slots.map((s) => s.movementPattern)).not.toContain('SQUAT');
      expect(result.slots[0].movementPattern).toBe('PUSH');
    });
  });
});

describe('planQuickSession', () => {
  const slot = (movementPattern: string, order: number) =>
    ({
      order,
      movementPattern,
      targetSets: 3,
      targetReps: 12,
      exercise: { id: movementPattern, name: movementPattern, muscleGroup: 'x', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
    }) as never;
  const slots = ['SQUAT', 'PUSH', 'PULL', 'HINGE', 'CORE_STABILITY'].map(slot);

  it('past bij elke toegestane tijd (10/15 min) altijd binnen de tijd (v2.5.4 harde grens)', () => {
    for (const minutes of QUICK_SESSION_MINUTE_OPTIONS) {
      const plan = planQuickSession(slots, new Map(), minutes);
      expect(plan).not.toBeNull();
      expect(plan!.estimatedSeconds).toBeLessThanOrEqual(minutes * 60);
      expect(plan!.slots.length).toBeLessThanOrEqual(4);
      expect(plan!.slots.every((s) => s.targetSets >= 2)).toBe(true);
    }
  });

  it('valt terug op minder oefeningen i.p.v. onder 2 sets te gaan (minimale uitvoerbaarheid)', () => {
    // 5 min = 300s: 4 sets × 70s = 280s → 2 oefeningen × 2 sets.
    const plan = planQuickSession(slots, new Map(), 5);

    expect(plan!.slots.map((s) => s.movementPattern)).toEqual(['SQUAT', 'PUSH']);
    expect(plan!.slots.every((s) => s.targetSets === 2)).toBe(true);
  });

  it('geeft null als er zelfs geen enkele oefening × 2 sets past', () => {
    expect(planQuickSession(slots, new Map(), 2)).toBeNull();
  });
});

describe('applyLightSession', () => {
  const slot = (targetSets: number, targetReps: number) =>
    ({
      order: 0,
      movementPattern: 'SQUAT',
      targetSets,
      targetReps,
      exercise: { id: 'x', name: 'x', muscleGroup: 'x', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
    }) as never;

  it('3×12 → 2×10 (v0.6 §10) en 3×14 (na INCREASE) → 2×12', () => {
    const [a, b] = applyLightSession([slot(3, 12), slot(3, 14)]);

    expect([a.targetSets, a.targetReps]).toEqual([2, 10]);
    expect([b.targetSets, b.targetReps]).toEqual([2, 12]);
  });

  it('maakt nooit zwaarder en zakt nooit onder 6 reps (RG06-bandbreedte)', () => {
    const [a] = applyLightSession([slot(1, 6)]);

    expect([a.targetSets, a.targetReps]).toEqual([1, 6]);
  });
});
