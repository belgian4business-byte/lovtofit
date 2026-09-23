import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BodyMeasurementsService } from './body-measurements.service.js';

describe('BodyMeasurementsService', () => {
  let prisma: {
    bodyMeasurement: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  };
  let service: BodyMeasurementsService;

  beforeEach(() => {
    prisma = {
      bodyMeasurement: {
        create: vi.fn().mockResolvedValue({ id: 'measurement-1' }),
        findMany: vi.fn(),
      },
    };
    service = new BodyMeasurementsService(prisma as never);
  });

  it('slaat elke meting op als een nieuwe rij, gekoppeld aan de ingelogde gebruiker', async () => {
    await service.logWeight('user-1', 82.4);

    expect(prisma.bodyMeasurement.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', weightKg: 82.4 },
    });
  });

  describe('getTrend', () => {
    function measurement(weightKg: number, daysAgo: number) {
      return { weightKg, measuredAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) };
    }

    it('NUT-002: geeft INSUFFICIENT_DATA met minder dan 3 metingen (geen verzonnen trend)', async () => {
      prisma.bodyMeasurement.findMany.mockResolvedValue([measurement(82, 1), measurement(81.8, 0)]);

      const result = await service.getTrend('user-1');

      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.direction).toBeNull();
      expect(result.latestWeightKg).toBe(81.8);
    });

    it('NUT-005: herkent een geleidelijk dalende trend over meerdere metingen', async () => {
      prisma.bodyMeasurement.findMany.mockResolvedValue([
        measurement(82.4, 3),
        measurement(82.1, 2),
        measurement(81.8, 1),
        measurement(81.6, 0),
      ]);

      const result = await service.getTrend('user-1');

      expect(result.status).toBe('HAS_TREND');
      expect(result.direction).toBe('DOWN');
    });

    it('NUT-004: een stabiele trend (klein verschil) wordt niet overgeïnterpreteerd als op- of neergaand', async () => {
      prisma.bodyMeasurement.findMany.mockResolvedValue([
        measurement(82.0, 3),
        measurement(82.1, 2),
        measurement(81.9, 1),
        measurement(82.0, 0),
      ]);

      const result = await service.getTrend('user-1');

      expect(result.status).toBe('HAS_TREND');
      expect(result.direction).toBe('STABLE');
    });

    it('herkent een stijgende trend', async () => {
      prisma.bodyMeasurement.findMany.mockResolvedValue([
        measurement(80.0, 2),
        measurement(80.6, 1),
        measurement(81.2, 0),
      ]);

      const result = await service.getTrend('user-1');

      expect(result.direction).toBe('UP');
    });

    it('geeft de geschiedenis terug met de nieuwste meting eerst', async () => {
      prisma.bodyMeasurement.findMany.mockResolvedValue([
        measurement(82.4, 2),
        measurement(82.1, 1),
        measurement(81.8, 0),
      ]);

      const result = await service.getTrend('user-1');

      expect(result.history.map((h) => h.weightKg)).toEqual([81.8, 82.1, 82.4]);
    });
  });
});
