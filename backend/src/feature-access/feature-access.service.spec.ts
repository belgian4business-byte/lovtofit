import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureAccessService } from './feature-access.service.js';
import { FEATURES } from './feature-keys.js';

// Testcodes volgen het Feature Access Test Lab uit blueprint v2.19.21.
describe('FeatureAccessService', () => {
  const now = new Date('2026-09-23T12:00:00Z');
  const tomorrow = new Date('2026-09-24T12:00:00Z');
  const yesterday = new Date('2026-09-22T12:00:00Z');

  const freeFeature = {
    active: true,
    planFeatures: [
      { plan: 'FREE', enabled: true },
      { plan: 'PREMIUM', enabled: true },
    ],
  };
  const premiumFeature = {
    active: true,
    planFeatures: [{ plan: 'PREMIUM', enabled: true }],
  };

  let prisma: {
    feature: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    subscription: { findFirst: ReturnType<typeof vi.fn> };
  };
  let service: FeatureAccessService;

  beforeEach(() => {
    prisma = {
      feature: { findUnique: vi.fn(), findMany: vi.fn() },
      subscription: { findFirst: vi.fn() },
    };
    service = new FeatureAccessService(prisma as never);
  });

  it('FA-001: FREE-gebruiker mag een gratis functie gebruiken', async () => {
    prisma.feature.findUnique.mockResolvedValue(freeFeature);
    prisma.subscription.findFirst.mockResolvedValue(null);

    expect(await service.canUse('user-1', 'CAN_USE_WATER_TRACKING', now)).toBe(true);
  });

  it('FA-002: FREE-gebruiker (geen abonnement) mag geen Premium-functie gebruiken', async () => {
    prisma.feature.findUnique.mockResolvedValue(premiumFeature);
    prisma.subscription.findFirst.mockResolvedValue(null);

    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(false);
  });

  it('FA-003: actief Premium mag een Premium-functie gebruiken', async () => {
    prisma.feature.findUnique.mockResolvedValue(premiumFeature);
    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'ACTIVE', expiresAt: null });

    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(true);
  });

  it('FA-004: lopende proefperiode geeft Premium-toegang', async () => {
    prisma.feature.findUnique.mockResolvedValue(premiumFeature);
    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'TRIAL', expiresAt: tomorrow });

    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(true);
  });

  it('FA-004: verlopen proefperiode geeft geen Premium-toegang meer', async () => {
    prisma.feature.findUnique.mockResolvedValue(premiumFeature);
    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'TRIAL', expiresAt: yesterday });

    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(false);
  });

  it('FA-005: EXPIRED geeft geen Premium-toegang, maar gratis functies blijven werken', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'EXPIRED', expiresAt: yesterday });

    prisma.feature.findUnique.mockResolvedValue(premiumFeature);
    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(false);

    prisma.feature.findUnique.mockResolvedValue(freeFeature);
    expect(await service.canUse('user-1', 'CAN_USE_HISTORY', now)).toBe(true);
  });

  it('FA-005: ACTIVE met verstreken einddatum telt als verlopen, ook zonder statuswijziging', async () => {
    prisma.feature.findUnique.mockResolvedValue(premiumFeature);
    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'ACTIVE', expiresAt: yesterday });

    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(false);
  });

  it('FA-006: opgezegd abonnement geeft toegang tot de einddatum', async () => {
    prisma.feature.findUnique.mockResolvedValue(premiumFeature);

    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'CANCELLED', expiresAt: tomorrow });
    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(true);

    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'CANCELLED', expiresAt: yesterday });
    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(false);
  });

  it('proefperiode of opzegging zonder einddatum wordt nooit stilletjes permanent Premium', async () => {
    prisma.feature.findUnique.mockResolvedValue(premiumFeature);

    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'TRIAL', expiresAt: null });
    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(false);

    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'CANCELLED', expiresAt: null });
    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(false);
  });

  it('FA-011: een globaal uitgeschakelde functie is dicht, ook voor Premium', async () => {
    prisma.feature.findUnique.mockResolvedValue({ ...premiumFeature, active: false });
    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'ACTIVE', expiresAt: null });

    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(false);
  });

  it('een onbekende functie (niet geseed) is dicht', async () => {
    prisma.feature.findUnique.mockResolvedValue(null);
    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'ACTIVE', expiresAt: null });

    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(false);
  });

  it('FA-013: na verlenging (nieuwste rij ACTIVE) is de toegang terug', async () => {
    prisma.feature.findUnique.mockResolvedValue(premiumFeature);
    prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'ACTIVE', expiresAt: tomorrow });

    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(true);
    // De service vraagt altijd de meest recente rij op, zodat een oude
    // EXPIRED-rij een nieuwe verlenging nooit overschaduwt.
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' }, orderBy: { startedAt: 'desc' } }),
    );
  });

  it('een FREE-abonnementrij geeft geen Premium-toegang', async () => {
    prisma.feature.findUnique.mockResolvedValue(premiumFeature);
    prisma.subscription.findFirst.mockResolvedValue({ plan: 'FREE', status: 'ACTIVE', expiresAt: null });

    expect(await service.canUse('user-1', 'CAN_USE_CALORIE_RANGE', now)).toBe(false);
  });

  describe('getFeatureAccess (GET /features)', () => {
    const seededRows = [
      { featureKey: 'CAN_USE_WATER_TRACKING', ...freeFeature },
      { featureKey: 'CAN_USE_CALORIE_RANGE', ...premiumFeature },
    ];

    it('FREE-gebruiker: gratis functies aan, Premium-functies uit', async () => {
      prisma.feature.findMany.mockResolvedValue(seededRows);
      prisma.subscription.findFirst.mockResolvedValue(null);

      const result = await service.getFeatureAccess('user-1', now);

      expect(result.plan).toBe('FREE');
      expect(result.features.CAN_USE_WATER_TRACKING).toBe(true);
      expect(result.features.CAN_USE_CALORIE_RANGE).toBe(false);
    });

    it('FA-004: proefperiode zet ook de Premium-functies aan', async () => {
      prisma.feature.findMany.mockResolvedValue(seededRows);
      prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'TRIAL', expiresAt: tomorrow });

      const result = await service.getFeatureAccess('user-1', now);

      expect(result.plan).toBe('PREMIUM');
      expect(result.features.CAN_USE_WATER_TRACKING).toBe(true);
      expect(result.features.CAN_USE_CALORIE_RANGE).toBe(true);
    });

    it('bevat altijd elke bekende sleutel; een niet-geseede functie staat op false', async () => {
      prisma.feature.findMany.mockResolvedValue(seededRows);
      prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'ACTIVE', expiresAt: null });

      const result = await service.getFeatureAccess('user-1', now);

      expect(Object.keys(result.features).sort()).toEqual(Object.keys(FEATURES).sort());
      expect(result.features.CAN_USE_QUICK_SESSION).toBe(false);
    });

    it('FA-011: een globaal uitgeschakelde functie staat ook in het overzicht op false', async () => {
      prisma.feature.findMany.mockResolvedValue([{ featureKey: 'CAN_USE_CALORIE_RANGE', ...premiumFeature, active: false }]);
      prisma.subscription.findFirst.mockResolvedValue({ plan: 'PREMIUM', status: 'ACTIVE', expiresAt: null });

      const result = await service.getFeatureAccess('user-1', now);

      expect(result.features.CAN_USE_CALORIE_RANGE).toBe(false);
    });
  });
});
