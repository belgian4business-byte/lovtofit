import { ConflictException, Injectable } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const TRIAL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface StartedTrial {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  expiresAt: Date;
}

/**
 * Fase 6, stap 5 (bron: blueprint v2.19.12 "7 dagen Premium proberen").
 * Premium activeren zonder echte betaling: een proefperiode is gewoon een
 * nieuwe `subscriptions`-rij (PREMIUM/TRIAL, 7 dagen). Na afloop valt de
 * gebruiker vanzelf terug naar FREE — de FeatureAccessService kijkt naar
 * `expiresAt` — en er wordt niets verwijderd (v2.19.10).
 *
 * Toegang zelf wordt hier niet bepaald; dat blijft uitsluitend de
 * FeatureAccessService.
 */
@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async startTrial(userId: string, now: Date = new Date()): Promise<StartedTrial> {
    // Serializable: twee gelijktijdige tikken mogen nooit twee proefperiodes
    // opleveren.
    return this.prisma.$transaction(
      async (tx) => {
        // Eén proefperiode per gebruiker, ooit ("trialregels", v2.19.18).
        // Wie al eens Premium had (trial of betaald), krijgt geen nieuwe.
        const earlierPremium = await tx.subscription.findFirst({
          where: { userId, plan: SubscriptionPlan.PREMIUM },
          select: { id: true },
        });
        if (earlierPremium) {
          throw new ConflictException('Je hebt de gratis proefperiode al gebruikt.');
        }

        const expiresAt = new Date(now.getTime() + TRIAL_DAYS * DAY_MS);
        await tx.subscription.create({
          data: {
            userId,
            plan: SubscriptionPlan.PREMIUM,
            status: SubscriptionStatus.TRIAL,
            startedAt: now,
            expiresAt,
          },
        });

        return { plan: SubscriptionPlan.PREMIUM, status: SubscriptionStatus.TRIAL, expiresAt };
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
