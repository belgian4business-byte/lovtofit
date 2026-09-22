import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCoachService } from '../ai-coach/ai-coach.service.js';
import { ProgressionEngineService } from '../progression-engine/progression-engine.service.js';
import { RuleGuardService } from '../rule-guard/rule-guard.service.js';
import { WorkoutSessionsService } from './workout-sessions.service.js';

const NORMAL_MOTIVATION = {
  signal: 'NORMAL',
  consistencyStreakWeeks: 0,
  weeklyTarget: 3,
  completedThisWeek: 0,
  totalSessionsCompleted: 0,
  milestone: null,
  daysSinceLastSession: null,
};

describe('WorkoutSessionsService', () => {
  let prisma: {
    workoutSession: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  };
  let progressionEngine: { evaluateSession: ReturnType<typeof vi.fn> };
  let motivationEngine: { getStatus: ReturnType<typeof vi.fn> };
  let service: WorkoutSessionsService;

  beforeEach(() => {
    prisma = {
      workoutSession: {
        create: vi.fn().mockResolvedValue({ id: 'session-1' }),
        findMany: vi.fn(),
      },
    };
    progressionEngine = { evaluateSession: vi.fn().mockResolvedValue([]) };
    motivationEngine = { getStatus: vi.fn().mockResolvedValue(NORMAL_MOTIVATION) };
    service = new WorkoutSessionsService(
      prisma as never,
      progressionEngine as unknown as ProgressionEngineService,
      new RuleGuardService(),
      motivationEngine as never,
      new AiCoachService(),
    );
  });

  it('weigert (RG10) een sessie met een dubbel aangeleverde set', async () => {
    await expect(
      service.save('user-1', {
        templateId: 'template-1',
        sets: [
          { exerciseId: 'exercise-1', setNumber: 1, reps: 12 },
          { exerciseId: 'exercise-1', setNumber: 1, reps: 12 },
        ],
        feedback: [{ exerciseId: 'exercise-1', difficulty: 'GOOD', discomfort: false }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workoutSession.create).not.toHaveBeenCalled();
  });

  it('slaat de sessie op met de ingelogde gebruiker, de gelogde sets en de feedback per oefening', async () => {
    await service.save('user-1', {
      templateId: 'template-1',
      sets: [
        { exerciseId: 'exercise-1', setNumber: 1, reps: 12, weightKg: undefined },
        { exerciseId: 'exercise-1', setNumber: 2, reps: 10, weightKg: 7.5 },
      ],
      feedback: [{ exerciseId: 'exercise-1', difficulty: 'GOOD', discomfort: false }],
    });

    expect(prisma.workoutSession.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        templateId: 'template-1',
        loggedSets: {
          create: [
            { exerciseId: 'exercise-1', setNumber: 1, reps: 12, weightKg: undefined },
            { exerciseId: 'exercise-1', setNumber: 2, reps: 10, weightKg: 7.5 },
          ],
        },
        feedback: {
          create: [{ exerciseId: 'exercise-1', difficulty: 'GOOD', discomfort: false }],
        },
      },
      include: { loggedSets: true, feedback: true },
    });
  });

  it('laat de Progression Engine elke gevoede oefening evalueren en geeft de beslissingen mee terug', async () => {
    progressionEngine.evaluateSession.mockResolvedValue([
      { exerciseId: 'exercise-1', decision: 'KEEP' },
    ]);

    const result = await service.save('user-1', {
      templateId: 'template-1',
      sets: [{ exerciseId: 'exercise-1', setNumber: 1, reps: 12 }],
      feedback: [{ exerciseId: 'exercise-1', difficulty: 'GOOD', discomfort: false }],
    });

    expect(progressionEngine.evaluateSession).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      [{ exerciseId: 'exercise-1', setNumber: 1, reps: 12 }],
      [{ exerciseId: 'exercise-1', difficulty: 'GOOD', discomfort: false }],
    );
    expect(result.progressionDecisions).toEqual([{ exerciseId: 'exercise-1', decision: 'KEEP' }]);
  });

  it('geeft een AI Coach-boodschap mee die pijn/ongemak erkent, voorrang op een mijlpaal', async () => {
    motivationEngine.getStatus.mockResolvedValue({ ...NORMAL_MOTIVATION, milestone: 10 });

    const result = await service.save('user-1', {
      templateId: 'template-1',
      sets: [{ exerciseId: 'exercise-1', setNumber: 1, reps: 12 }],
      feedback: [{ exerciseId: 'exercise-1', difficulty: 'HARD', discomfort: true }],
    });

    expect(result.coachMessage).toContain('ongemak');
  });

  it('geeft de sessies van de gebruiker terug, met oefeningnamen i.p.v. losse ids', async () => {
    const completedAt = new Date('2026-09-22T10:00:00.000Z');
    prisma.workoutSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        completedAt,
        template: { name: 'Beginner Full Body' },
        loggedSets: [
          {
            setNumber: 1,
            reps: 12,
            weightKg: null,
            exercise: { name: 'Bodyweight Squat' },
          },
        ],
      },
    ]);

    const result = await service.listForUser('user-1');

    expect(prisma.workoutSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
    expect(result).toEqual([
      {
        id: 'session-1',
        templateName: 'Beginner Full Body',
        completedAt,
        sets: [{ exerciseName: 'Bodyweight Squat', setNumber: 1, reps: 12, weightKg: null }],
      },
    ]);
  });
});
