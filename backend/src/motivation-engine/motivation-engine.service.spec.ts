import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotivationEngineService } from './motivation-engine.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('MotivationEngineService', () => {
  let prisma: {
    trainingPreferences: { findUnique: ReturnType<typeof vi.fn> };
    workoutSession: { findMany: ReturnType<typeof vi.fn> };
  };
  let service: MotivationEngineService;

  beforeEach(() => {
    prisma = {
      trainingPreferences: { findUnique: vi.fn() },
      workoutSession: { findMany: vi.fn().mockResolvedValue([]) },
    };
    service = new MotivationEngineService(prisma as never);
  });

  function sessionsAgo(...daysAgoList: number[]) {
    return daysAgoList
      .map((daysAgo) => ({ completedAt: new Date(Date.now() - daysAgo * DAY_MS) }))
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  }

  it('gooit een NotFoundException als de onboarding nog niet is afgerond', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue(null);

    await expect(service.getStatus('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('MOT-001/002: geeft CONSISTENCY_GOOD als de gebruiker zijn weekdoel haalt', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ weeklyFrequency: 3 });
    prisma.workoutSession.findMany.mockResolvedValue(sessionsAgo(0, 2, 4, 8, 10, 12));

    const result = await service.getStatus('user-1');

    expect(result.signal).toBe('CONSISTENCY_GOOD');
    expect(result.completedThisWeek).toBe(3);
  });

  it('MOT-003/004: de nog lopende week telt niet mee als "achteruitgang" t.o.v. volledig afgeronde weken', async () => {
    // Vorige twee (volledig afgeronde) weken waren prima; deze week is
    // simpelweg nog niet voorbij. Dat mag nooit als straf/daling tellen.
    prisma.trainingPreferences.findUnique.mockResolvedValue({ weeklyFrequency: 3 });
    prisma.workoutSession.findMany.mockResolvedValue(sessionsAgo(2, 10, 11, 12, 15, 16, 17));

    const result = await service.getStatus('user-1');

    expect(result.signal).toBe('NORMAL');
  });

  it('behoudt de streak over een geplande rustdag heen (streak kijkt per week, niet per kalenderdag)', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ weeklyFrequency: 2 });
    // Deze week: 2 trainingen (streak +1). Vorige week: 2 trainingen (streak +1).
    prisma.workoutSession.findMany.mockResolvedValue(sessionsAgo(0, 3, 8, 11));

    const result = await service.getStatus('user-1');

    expect(result.consistencyStreakWeeks).toBe(2);
  });

  it('MOT-006: geeft CONSISTENCY_DECLINING bij een daling over twee volledig afgeronde weken', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ weeklyFrequency: 3 });
    // 2 weken geleden 3/3, vorige week nog maar 1 — een echte trend over
    // afgeronde weken, niet de nog lopende week.
    prisma.workoutSession.findMany.mockResolvedValue(sessionsAgo(10, 15, 17, 19));

    const result = await service.getStatus('user-1');

    expect(result.signal).toBe('CONSISTENCY_DECLINING');
  });

  it('MOT-007: geeft AT_RISK_OF_DROPOUT pas bij drie volledig afgeronde weken op rij onder doel', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ weeklyFrequency: 3 });
    prisma.workoutSession.findMany.mockResolvedValue(sessionsAgo(10, 17, 24));

    const result = await service.getStatus('user-1');

    expect(result.signal).toBe('AT_RISK_OF_DROPOUT');
  });

  it('MOT-008: geeft RETURN_AFTER_ABSENCE na 14+ dagen niets gedaan te hebben, prioriteit boven alles', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ weeklyFrequency: 3 });
    prisma.workoutSession.findMany.mockResolvedValue(sessionsAgo(21, 28, 35));

    const result = await service.getStatus('user-1');

    expect(result.signal).toBe('RETURN_AFTER_ABSENCE');
  });

  it('MOT-009/010: geeft MILESTONE_REACHED bij een mijlpaal-aantal trainingen', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ weeklyFrequency: 3 });
    prisma.workoutSession.findMany.mockResolvedValue(sessionsAgo(0));

    const result = await service.getStatus('user-1');

    expect(result.signal).toBe('MILESTONE_REACHED');
    expect(result.milestone).toBe(1);
  });

  it('geeft NORMAL/0 als er nog nooit getraind is (nog geen geschiedenis om te beoordelen)', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue({ weeklyFrequency: 3 });
    prisma.workoutSession.findMany.mockResolvedValue([]);

    const result = await service.getStatus('user-1');

    expect(result.signal).toBe('NORMAL');
    expect(result.consistencyStreakWeeks).toBe(0);
    expect(result.totalSessionsCompleted).toBe(0);
  });
});
