import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecoveryEngineService } from './recovery-engine.service.js';

describe('RecoveryEngineService', () => {
  let prisma: {
    loggedSet: { findMany: ReturnType<typeof vi.fn> };
    exerciseFeedback: { findMany: ReturnType<typeof vi.fn> };
  };
  let service: RecoveryEngineService;

  beforeEach(() => {
    prisma = {
      loggedSet: { findMany: vi.fn().mockResolvedValue([]) },
      exerciseFeedback: { findMany: vi.fn().mockResolvedValue([]) },
    };
    service = new RecoveryEngineService(prisma as never);
  });

  function set(reps: number, daysAgo: number, sessionId = 'session-1') {
    const completedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return {
      sessionId,
      exerciseId: 'exercise-1',
      reps,
      exercise: { movementPattern: 'SQUAT', muscleGroup: 'LEGS_GLUTES' },
      session: { id: sessionId, completedAt },
    };
  }

  it('geeft NORMAL voor een movement pattern zonder recente training', async () => {
    const report = await service.getStatus('user-1');

    const squat = report.byMovementPattern.find((entry) => entry.key === 'SQUAT');
    expect(squat).toEqual({ key: 'SQUAT', status: 'NORMAL', loadScore: 0 });
  });

  it('geeft alle movement patterns en spiergroepen terug, ook zonder data', async () => {
    const report = await service.getStatus('user-1');

    expect(report.byMovementPattern.map((e) => e.key).sort()).toEqual(
      [
        'PUSH', 'PULL', 'SQUAT', 'HINGE', 'LUNGE', 'CARRY',
        'CORE_STABILITY', 'ROTATION', 'CARDIO', 'MOBILITY',
      ].sort(),
    );
    expect(report.byMuscleGroup).toHaveLength(8);
  });

  it('geeft RECENTLY_LOADED na één normale training gisteren (blueprint v2.15.4)', async () => {
    prisma.loggedSet.findMany.mockResolvedValue([set(12, 1), set(12, 1), set(12, 1)]);
    prisma.exerciseFeedback.findMany.mockResolvedValue([
      { sessionId: 'session-1', exerciseId: 'exercise-1', difficulty: 'GOOD' },
    ]);

    const report = await service.getStatus('user-1');

    const squat = report.byMovementPattern.find((entry) => entry.key === 'SQUAT')!;
    expect(squat.status).toBe('RECENTLY_LOADED');
  });

  it('geeft RECOVERY na herhaalde zware training in de afgelopen dagen', async () => {
    prisma.loggedSet.findMany.mockResolvedValue([
      ...['a', 'b'].flatMap((id) => [
        set(12, 0, `session-${id}-1`),
        set(12, 0, `session-${id}-2`),
        set(12, 1, `session-${id}-3`),
      ]),
    ]);
    prisma.exerciseFeedback.findMany.mockResolvedValue([]);

    const report = await service.getStatus('user-1');

    const squat = report.byMovementPattern.find((entry) => entry.key === 'SQUAT')!;
    expect(squat.status).toBe('RECOVERY');
  });

  it('laat een training van 10 dagen geleden nauwelijks meetellen (verval, geen harde 48u-regel)', async () => {
    prisma.loggedSet.findMany.mockResolvedValue([set(12, 10), set(12, 10), set(12, 10)]);
    prisma.exerciseFeedback.findMany.mockResolvedValue([]);

    const report = await service.getStatus('user-1');

    const squat = report.byMovementPattern.find((entry) => entry.key === 'SQUAT')!;
    expect(squat.status).toBe('NORMAL');
  });

  it('geeft geen medische precisie: alleen een status en een intern loadScore, geen percentage', async () => {
    const report = await service.getStatus('user-1');

    for (const entry of [...report.byMovementPattern, ...report.byMuscleGroup]) {
      expect(['NORMAL', 'RECENTLY_LOADED', 'RECOVERY']).toContain(entry.status);
      expect(typeof entry.loadScore).toBe('number');
    }
  });
});
