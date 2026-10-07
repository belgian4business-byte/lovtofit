import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalStatus, GoalType } from '../generated/prisma/enums.js';
import { OnboardingService } from './onboarding.service.js';

describe('OnboardingService', () => {
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    goal: {
      findMany: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      createMany: ReturnType<typeof vi.fn>;
    };
    trainingPreferences: { upsert: ReturnType<typeof vi.fn> };
  };
  let onboardingService: OnboardingService;

  const dto = {
    goals: [GoalType.LOSE_WEIGHT],
    location: 'HOME',
    equipment: ['NONE'],
    sessionDuration: 'MIN_30',
    weeklyFrequency: 3,
    level: 'BEGINNER',
  } as never;

  beforeEach(() => {
    prisma = {
      $transaction: vi.fn((callback: (tx: typeof prisma) => unknown) => callback(prisma)),
      goal: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        createMany: vi.fn(),
      },
      trainingPreferences: { upsert: vi.fn().mockResolvedValue({}) },
    };
    onboardingService = new OnboardingService(prisma as never);
  });

  it('maakt nieuwe actieve doelen aan die nog niet bestonden', async () => {
    await onboardingService.submit('user-1', dto);

    expect(prisma.goal.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', type: GoalType.LOSE_WEIGHT }],
    });
  });

  it('pauzeert oude actieve doelen die niet meer geselecteerd zijn, in plaats van ze te verwijderen', async () => {
    prisma.goal.findMany.mockResolvedValueOnce([
      { id: 'goal-1', userId: 'user-1', type: GoalType.BUILD_MUSCLE, status: GoalStatus.ACTIVE },
    ]);

    await onboardingService.submit('user-1', dto);

    expect(prisma.goal.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['goal-1'] } },
      data: { status: GoalStatus.PAUSED, pausedAt: expect.any(Date) },
    });
  });

  it('laat een al actief doel met rust als het opnieuw geselecteerd wordt', async () => {
    prisma.goal.findMany.mockResolvedValueOnce([
      { id: 'goal-1', userId: 'user-1', type: GoalType.LOSE_WEIGHT, status: GoalStatus.ACTIVE },
    ]);

    await onboardingService.submit('user-1', dto);

    expect(prisma.goal.updateMany).not.toHaveBeenCalled();
    expect(prisma.goal.createMany).not.toHaveBeenCalled();
  });

  describe('get (profiel-scherm)', () => {
    it('geeft e-mail, alleen de actieve doelen en de voorkeuren terug', async () => {
      const preferences = { location: 'HOME', equipment: ['NONE'], weeklyFrequency: 3 };
      const findUniqueOrThrow = vi.fn().mockResolvedValue({
        email: 'a@example.com',
        goals: [{ type: GoalType.LOSE_WEIGHT }, { type: GoalType.GET_FIT }],
        trainingPreferences: preferences,
      });
      onboardingService = new OnboardingService({ ...prisma, user: { findUniqueOrThrow } } as never);

      const result = await onboardingService.get('user-1');

      expect(findUniqueOrThrow.mock.calls[0][0].select.goals.where).toEqual({
        status: GoalStatus.ACTIVE,
      });
      expect(result).toEqual({
        email: 'a@example.com',
        goals: [GoalType.LOSE_WEIGHT, GoalType.GET_FIT],
        preferences,
      });
    });

    it('geeft preferences null als de onboarding nog niet af is', async () => {
      const findUniqueOrThrow = vi.fn().mockResolvedValue({
        email: 'a@example.com',
        goals: [],
        trainingPreferences: null,
      });
      onboardingService = new OnboardingService({ ...prisma, user: { findUniqueOrThrow } } as never);

      expect(await onboardingService.get('user-1')).toEqual({
        email: 'a@example.com',
        goals: [],
        preferences: null,
      });
    });
  });
});
