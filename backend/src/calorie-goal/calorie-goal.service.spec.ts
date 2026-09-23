import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalorieGoalService } from './calorie-goal.service.js';

describe('CalorieGoalService', () => {
  let prisma: {
    goal: { findFirst: ReturnType<typeof vi.fn> };
    bodyMeasurement: { findFirst: ReturnType<typeof vi.fn> };
  };
  let featureAccess: { canUse: ReturnType<typeof vi.fn> };
  let service: CalorieGoalService;

  beforeEach(() => {
    prisma = {
      goal: { findFirst: vi.fn() },
      bodyMeasurement: { findFirst: vi.fn() },
    };
    // Standaard Premium, zodat de bestaande range-tests ongewijzigd blijven;
    // de FREE-situatie wordt hieronder apart getest.
    featureAccess = { canUse: vi.fn().mockResolvedValue(true) };
    service = new CalorieGoalService(prisma as never, featureAccess as never);
  });

  it('NUT-007: geeft NOT_APPLICABLE zonder een actief gewichtsgerelateerd doel', async () => {
    prisma.goal.findFirst.mockResolvedValue(null);

    const result = await service.getStatus('user-1');

    expect(result.status).toBe('NOT_APPLICABLE');
    expect(result.rangeLowKcal).toBeNull();
  });

  it('NUT-002: geeft LIMITED_ESTIMATE als er wel een doel is maar nog geen gewicht bekend is', async () => {
    prisma.goal.findFirst.mockResolvedValue({ type: 'LOSE_WEIGHT' });
    prisma.bodyMeasurement.findFirst.mockResolvedValue(null);

    const result = await service.getStatus('user-1');

    expect(result.status).toBe('LIMITED_ESTIMATE');
    expect(result.goalType).toBe('LOSE_WEIGHT');
    expect(result.rangeLowKcal).toBeNull();
  });

  it('NUT-007/NUT-001: geeft een gematigd tekort-range bij LOSE_WEIGHT', async () => {
    prisma.goal.findFirst.mockResolvedValue({ type: 'LOSE_WEIGHT' });
    prisma.bodyMeasurement.findFirst.mockResolvedValue({ weightKg: 80 });

    const result = await service.getStatus('user-1');

    expect(result.status).toBe('HAS_RANGE');
    // Baseline 80*30=2400, tekort 15% -> 2040 middelpunt, ±10% -> 1836-2244,
    // afgerond op 50 kcal.
    expect(result.rangeLowKcal).toBe(1850);
    expect(result.rangeHighKcal).toBe(2250);
    expect(result.rangeLowKcal!).toBeLessThan(80 * 30);
  });

  it('NUT-006: geeft een gematigd overschot-range bij BUILD_MUSCLE', async () => {
    prisma.goal.findFirst.mockResolvedValue({ type: 'BUILD_MUSCLE' });
    prisma.bodyMeasurement.findFirst.mockResolvedValue({ weightKg: 80 });

    const result = await service.getStatus('user-1');

    expect(result.status).toBe('HAS_RANGE');
    // Baseline 80*30=2400, overschot 10% -> 2640 middelpunt, ±10% -> 2376-2904,
    // afgerond op 50 kcal. Het middelpunt ligt boven de neutrale baseline.
    expect(result.rangeLowKcal).toBe(2400);
    expect(result.rangeHighKcal).toBe(2900);
  });

  it('geeft altijd een range, nooit één enkel getal', async () => {
    prisma.goal.findFirst.mockResolvedValue({ type: 'LOSE_WEIGHT' });
    prisma.bodyMeasurement.findFirst.mockResolvedValue({ weightKg: 70 });

    const result = await service.getStatus('user-1');

    expect(result.rangeLowKcal).not.toBe(result.rangeHighKcal);
  });

  it('FA-002: FREE-gebruiker met gewichtsdoel krijgt PREMIUM_REQUIRED, zonder range', async () => {
    featureAccess.canUse.mockResolvedValue(false);
    prisma.goal.findFirst.mockResolvedValue({ type: 'LOSE_WEIGHT' });
    prisma.bodyMeasurement.findFirst.mockResolvedValue({ weightKg: 80 });

    const result = await service.getStatus('user-1');

    expect(featureAccess.canUse).toHaveBeenCalledWith('user-1', 'CAN_USE_CALORIE_RANGE');
    expect(result.status).toBe('PREMIUM_REQUIRED');
    expect(result.goalType).toBe('LOSE_WEIGHT');
    expect(result.rangeLowKcal).toBeNull();
    expect(result.rangeHighKcal).toBeNull();
  });

  it('geen Premium-teaser zonder gewichtsdoel: FREE-gebruiker blijft NOT_APPLICABLE', async () => {
    featureAccess.canUse.mockResolvedValue(false);
    prisma.goal.findFirst.mockResolvedValue(null);

    const result = await service.getStatus('user-1');

    expect(result.status).toBe('NOT_APPLICABLE');
    expect(featureAccess.canUse).not.toHaveBeenCalled();
  });
});
