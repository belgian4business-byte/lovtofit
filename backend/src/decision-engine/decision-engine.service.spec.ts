import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCoachService } from '../ai-coach/ai-coach.service.js';
import { RuleGuardService } from '../rule-guard/rule-guard.service.js';
import { DecisionEngineService } from './decision-engine.service.js';

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
    service = new DecisionEngineService(
      prisma as never,
      recoveryEngine as never,
      new RuleGuardService(),
      motivationEngine as never,
      new AiCoachService(),
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
});
