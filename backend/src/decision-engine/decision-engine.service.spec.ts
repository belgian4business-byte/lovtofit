import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DecisionEngineService } from './decision-engine.service.js';

describe('DecisionEngineService', () => {
  let prisma: {
    trainingPreferences: { findUnique: ReturnType<typeof vi.fn> };
    workoutTemplate: { findMany: ReturnType<typeof vi.fn> };
    exercise: { findMany: ReturnType<typeof vi.fn> };
  };
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

  beforeEach(() => {
    prisma = {
      trainingPreferences: { findUnique: vi.fn() },
      workoutTemplate: { findMany: vi.fn().mockResolvedValue([template]) },
      exercise: { findMany: vi.fn() },
    };
    service = new DecisionEngineService(prisma as never);
  });

  it('gooit een NotFoundException als de onboarding nog niet is afgerond', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue(null);

    await expect(service.getTodaysWorkout('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('kiest alleen bodyweight-oefeningen als de gebruiker geen apparatuur heeft', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({
      level: 'BEGINNER',
      equipment: ['NONE'],
    });
    prisma.exercise.findMany.mockImplementation(({ where }) => {
      const all = [
        { id: '1', name: 'Bodyweight Squat', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
        { id: '2', name: 'Goblet Squat', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'DUMBBELL', level: 'BEGINNER' },
        { id: '3', name: 'Knee Push-up', muscleGroup: 'CHEST', movementPattern: 'PUSH', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
      ];
      return Promise.resolve(
        all.filter(
          (e) =>
            e.movementPattern === where.movementPattern &&
            where.equipment.in.includes(e.equipment),
        ),
      );
    });

    const result = await service.getTodaysWorkout('user-1');

    expect(result.templateName).toBe('Beginner Full Body');
    expect(result.slots).toHaveLength(2);
    expect(result.slots.every((slot) => slot.exercise.equipment === 'BODYWEIGHT')).toBe(true);
    expect(result.slots[0].exercise.name).toBe('Bodyweight Squat');
    expect(result.slots[1].exercise.name).toBe('Knee Push-up');
  });

  it('mag dumbbell-oefeningen kiezen als de gebruiker dumbbells heeft', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({
      level: 'INTERMEDIATE',
      equipment: ['DUMBBELLS'],
    });
    prisma.exercise.findMany.mockImplementation(({ where }) => {
      if (where.movementPattern !== 'SQUAT') return Promise.resolve([]);
      return Promise.resolve(
        [
          { id: '1', name: 'Bodyweight Squat', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
          { id: '2', name: 'Goblet Squat', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'DUMBBELL', level: 'INTERMEDIATE' },
        ].filter((e) => where.equipment.in.includes(e.equipment)),
      );
    });

    const allowed = await service['allowedExerciseEquipment'](['DUMBBELLS']);
    expect(allowed).toEqual(expect.arrayContaining(['BODYWEIGHT', 'DUMBBELL']));
  });

  it('gooit een NotFoundException als er geen oefening past bij een slot', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({
      level: 'BEGINNER',
      equipment: ['NONE'],
    });
    prisma.exercise.findMany.mockResolvedValue([]);

    await expect(service.getTodaysWorkout('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
