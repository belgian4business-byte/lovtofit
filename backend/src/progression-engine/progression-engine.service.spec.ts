import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressionEngineService } from './progression-engine.service.js';

describe('ProgressionEngineService', () => {
  let prisma: {
    exerciseFeedback: { findMany: ReturnType<typeof vi.fn> };
    exerciseProgression: { create: ReturnType<typeof vi.fn> };
  };
  let service: ProgressionEngineService;

  const sets = [{ exerciseId: 'ex-1', reps: 10 }];

  function historyEntry(difficulty: string, reps: number) {
    return {
      difficulty,
      session: { loggedSets: [{ exerciseId: 'ex-1', reps, weightKg: null }] },
    };
  }

  beforeEach(() => {
    prisma = {
      exerciseFeedback: { findMany: vi.fn().mockResolvedValue([]) },
      exerciseProgression: { create: vi.fn().mockResolvedValue({}) },
    };
    service = new ProgressionEngineService(prisma as never);
  });

  it('geeft REPLACE als er discomfort is gemeld, ongeacht de rest', async () => {
    const result = await service.evaluateSession(
      'user-1',
      'session-1',
      sets,
      [{ exerciseId: 'ex-1', difficulty: 'TOO_HARD', discomfort: true }],
    );

    expect(result).toEqual([{ exerciseId: 'ex-1', decision: 'REPLACE' }]);
    expect(prisma.exerciseFeedback.findMany).not.toHaveBeenCalled();
  });

  it('geeft KEEP bij onvoldoende historie (eerste keer deze oefening)', async () => {
    prisma.exerciseFeedback.findMany.mockResolvedValue([]);

    const result = await service.evaluateSession('user-1', 'session-1', sets, [
      { exerciseId: 'ex-1', difficulty: 'EASY', discomfort: false },
    ]);

    expect(result).toEqual([{ exerciseId: 'ex-1', decision: 'KEEP' }]);
  });

  it('geeft KEEP bij één geïsoleerde slechte training, geen trend', async () => {
    prisma.exerciseFeedback.findMany.mockResolvedValue([
      historyEntry('GOOD', 10),
      historyEntry('GOOD', 10),
    ]);

    const result = await service.evaluateSession('user-1', 'session-1', sets, [
      { exerciseId: 'ex-1', difficulty: 'TOO_HARD', discomfort: false },
    ]);

    expect(result).toEqual([{ exerciseId: 'ex-1', decision: 'KEEP' }]);
  });

  it('geeft DECREASE bij drie keer op rij te zwaar', async () => {
    prisma.exerciseFeedback.findMany.mockResolvedValue([
      historyEntry('TOO_HARD', 6),
      historyEntry('TOO_HARD', 7),
    ]);

    const result = await service.evaluateSession('user-1', 'session-1', sets, [
      { exerciseId: 'ex-1', difficulty: 'TOO_HARD', discomfort: false },
    ]);

    expect(result).toEqual([{ exerciseId: 'ex-1', decision: 'DECREASE' }]);
  });

  it('geeft INCREASE bij drie keer op rij makkelijk', async () => {
    prisma.exerciseFeedback.findMany.mockResolvedValue([
      historyEntry('EASY', 12),
      historyEntry('EASY', 11),
    ]);

    const result = await service.evaluateSession('user-1', 'session-1', sets, [
      { exerciseId: 'ex-1', difficulty: 'EASY', discomfort: false },
    ]);

    expect(result).toEqual([{ exerciseId: 'ex-1', decision: 'INCREASE' }]);
  });

  it('geeft KEEP bij stabiele, gelijke prestatie met goede feedback', async () => {
    prisma.exerciseFeedback.findMany.mockResolvedValue([historyEntry('GOOD', 10)]);

    const result = await service.evaluateSession('user-1', 'session-1', sets, [
      { exerciseId: 'ex-1', difficulty: 'GOOD', discomfort: false },
    ]);

    expect(result).toEqual([{ exerciseId: 'ex-1', decision: 'KEEP' }]);
  });

  it('geeft INCREASE bij een verbeterende trend (meer reps dan vorige keer)', async () => {
    prisma.exerciseFeedback.findMany.mockResolvedValue([historyEntry('GOOD', 8)]);

    const result = await service.evaluateSession('user-1', 'session-1', sets, [
      { exerciseId: 'ex-1', difficulty: 'EASY', discomfort: false },
    ]);

    expect(result).toEqual([{ exerciseId: 'ex-1', decision: 'INCREASE' }]);
  });

  it('bewaart de beslissing per oefening', async () => {
    await service.evaluateSession('user-1', 'session-1', sets, [
      { exerciseId: 'ex-1', difficulty: 'TOO_HARD', discomfort: true },
    ]);

    expect(prisma.exerciseProgression.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', exerciseId: 'ex-1', sessionId: 'session-1', decision: 'REPLACE' },
    });
  });
});
