import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCoachService } from '../ai-coach/ai-coach.service.js';
import { RuleGuardService } from '../rule-guard/rule-guard.service.js';
import { ScheduleService } from './schedule.service.js';

describe('ScheduleService', () => {
  let prisma: {
    trainingPreferences: { findUnique: ReturnType<typeof vi.fn> };
    workoutSession: { findMany: ReturnType<typeof vi.fn> };
  };
  let featureAccess: { canUse: ReturnType<typeof vi.fn> };
  let motivationEngine: { getStatus: ReturnType<typeof vi.fn> };
  let ruleGuard: RuleGuardService;
  let service: ScheduleService;

  // Donderdag 24 september 2026, 10:00 in België.
  const now = new Date('2026-09-24T08:00:00Z');

  beforeEach(() => {
    prisma = {
      trainingPreferences: {
        findUnique: vi.fn().mockResolvedValue({ weeklyFrequency: 3, createdAt: new Date('2026-09-01T10:00:00Z') }),
      },
      workoutSession: { findMany: vi.fn().mockResolvedValue([]) },
    };
    featureAccess = { canUse: vi.fn().mockResolvedValue(true) };
    motivationEngine = { getStatus: vi.fn().mockResolvedValue({ signal: 'NORMAL' }) };
    ruleGuard = new RuleGuardService();
    service = new ScheduleService(
      prisma as never,
      featureAccess as never,
      ruleGuard,
      motivationEngine as never,
      new AiCoachService(),
    );
  });

  it('gooit een NotFoundException als de onboarding nog niet is afgerond', async () => {
    prisma.trainingPreferences.findUnique.mockResolvedValue(null);

    await expect(service.getWeek('user-1', now)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('herplant een gemiste woensdag met Premium (Belgische kalenderdagen)', async () => {
    // Maandag 23:30 Belgische tijd = maandag, ook al is het in UTC 21:30.
    prisma.workoutSession.findMany.mockResolvedValue([{ completedAt: new Date('2026-09-21T21:30:00Z') }]);

    const result = await service.getWeek('user-1', now);

    expect(featureAccess.canUse).toHaveBeenCalledWith('user-1', 'CAN_USE_SMART_RESCHEDULE', now);
    expect(result.today).toBe('2026-09-24');
    expect(result.days.map((d) => d.status)).toEqual(['DONE', 'REST', 'MISSED', 'PLANNED', 'REST', 'PLANNED', 'REST']);
    expect(result.smartReschedule).toBe('APPLIED');
    expect(result.coachMessage).toBe(
      'Geen probleem, we gaan gewoon verder. 💪 Ik heb je week aangepast: je trainingen staan nu gepland voor vandaag en zaterdag. Je hoeft niets in te halen.',
    );
  });

  it('geen coach-boodschap als er niets gemist of verschoven is', async () => {
    prisma.workoutSession.findMany.mockResolvedValue([
      { completedAt: new Date('2026-09-21T10:00:00Z') },
      { completedAt: new Date('2026-09-23T10:00:00Z') },
    ]);

    const result = await service.getWeek('user-1', now);

    expect(result.missedCount).toBe(0);
    expect(result.coachMessage).toBeNull();
  });

  it('Free: geen herplanning, alleen het standaardschema', async () => {
    featureAccess.canUse.mockResolvedValue(false);
    prisma.workoutSession.findMany.mockResolvedValue([{ completedAt: new Date('2026-09-21T10:00:00Z') }]);

    const result = await service.getWeek('user-1', now);

    expect(result.smartReschedule).toBe('PREMIUM_REQUIRED');
    expect(result.days.filter((d) => d.status === 'PLANNED').map((d) => d.weekday)).toEqual(['FRI']);
  });

  it('faalt luid als de Rule Guard de planning blokkeert', async () => {
    vi.spyOn(ruleGuard, 'checkSchedule').mockReturnValue({ passed: false, violations: ['RG08: test'], warnings: [] });

    await expect(service.getWeek('user-1', now)).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
