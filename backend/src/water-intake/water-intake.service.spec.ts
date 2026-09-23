import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WaterIntakeService } from './water-intake.service.js';

describe('WaterIntakeService', () => {
  let prisma: {
    waterIntake: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    bodyMeasurement: { findFirst: ReturnType<typeof vi.fn> };
  };
  let service: WaterIntakeService;

  beforeEach(() => {
    prisma = {
      waterIntake: {
        create: vi.fn().mockResolvedValue({ id: 'intake-1' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      bodyMeasurement: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    service = new WaterIntakeService(prisma as never);
  });

  it('slaat elke registratie op als een nieuwe rij, gekoppeld aan de ingelogde gebruiker', async () => {
    await service.logIntake('user-1', 250);

    expect(prisma.waterIntake.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', amountMl: 250 },
    });
  });

  describe('getTodayStatus', () => {
    it('valt terug op een vast standaarddoel als er nog geen gewicht bekend is', async () => {
      prisma.waterIntake.findMany.mockResolvedValue([{ amountMl: 250 }, { amountMl: 250 }]);

      const status = await service.getTodayStatus('user-1');

      expect(status.totalMl).toBe(500);
      expect(status.targetMl).toBe(2000);
      expect(status.remainingMl).toBe(1500);
    });

    it('berekent het doel op basis van het laatst bekende gewicht, afgerond op een glas', async () => {
      prisma.bodyMeasurement.findFirst.mockResolvedValue({ weightKg: 80 });

      const status = await service.getTodayStatus('user-1');

      // 80 * 30 ml/kg = 2400 ml, afgerond op het dichtstbijzijnde glas (250 ml) = 2500.
      expect(status.targetMl).toBe(2500);
    });

    it('laat het restant nooit negatief worden als het doel al gehaald is', async () => {
      prisma.waterIntake.findMany.mockResolvedValue([{ amountMl: 3000 }]);

      const status = await service.getTodayStatus('user-1');

      expect(status.remainingMl).toBe(0);
    });
  });
});
