import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionsService } from './subscriptions.service.js';

describe('SubscriptionsService', () => {
  const now = new Date('2026-09-23T12:00:00Z');

  let tx: {
    subscription: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  };
  let prisma: { $transaction: ReturnType<typeof vi.fn> };
  let service: SubscriptionsService;

  beforeEach(() => {
    tx = { subscription: { findFirst: vi.fn(), create: vi.fn() } };
    prisma = { $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)) };
    service = new SubscriptionsService(prisma as never);
  });

  it('start een proefperiode van 7 dagen als nieuwe PREMIUM/TRIAL-rij', async () => {
    tx.subscription.findFirst.mockResolvedValue(null);

    const result = await service.startTrial('user-1', now);

    const expiresAt = new Date('2026-09-30T12:00:00Z');
    expect(result).toEqual({ plan: 'PREMIUM', status: 'TRIAL', expiresAt });
    expect(tx.subscription.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', plan: 'PREMIUM', status: 'TRIAL', startedAt: now, expiresAt },
    });
  });

  it('geeft maar één proefperiode per gebruiker: bij eerdere Premium een 409, niets aangemaakt', async () => {
    tx.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });

    await expect(service.startTrial('user-1', now)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', plan: 'PREMIUM' } }),
    );
    expect(tx.subscription.create).not.toHaveBeenCalled();
  });

  it('draait in een serializable transactie (geen dubbele proefperiode bij dubbel tikken)', async () => {
    tx.subscription.findFirst.mockResolvedValue(null);

    await service.startTrial('user-1', now);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
});
