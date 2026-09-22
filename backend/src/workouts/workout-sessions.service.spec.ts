import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutSessionsService } from './workout-sessions.service.js';

describe('WorkoutSessionsService', () => {
  let prisma: {
    workoutSession: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  };
  let service: WorkoutSessionsService;

  beforeEach(() => {
    prisma = {
      workoutSession: {
        create: vi.fn().mockResolvedValue({ id: 'session-1' }),
        findMany: vi.fn(),
      },
    };
    service = new WorkoutSessionsService(prisma as never);
  });

  it('slaat de sessie op met de ingelogde gebruiker en de gelogde sets', async () => {
    await service.save('user-1', {
      templateId: 'template-1',
      sets: [
        { exerciseId: 'exercise-1', setNumber: 1, reps: 12, weightKg: undefined },
        { exerciseId: 'exercise-1', setNumber: 2, reps: 10, weightKg: 7.5 },
      ],
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
      },
      include: { loggedSets: true },
    });
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
