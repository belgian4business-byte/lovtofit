import { Injectable } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FEATURES, type FeatureKey } from './feature-keys.js';

interface SubscriptionSnapshot {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  expiresAt: Date | null;
}

interface FeatureSnapshot {
  active: boolean;
  planFeatures: { plan: SubscriptionPlan; enabled: boolean }[];
}

export interface FeatureAccessReport {
  plan: SubscriptionPlan;
  features: Record<FeatureKey, boolean>;
}

const FEATURE_SELECT = {
  active: true,
  planFeatures: { select: { plan: true, enabled: true } },
} as const;

/**
 * Fase 6, stap 1 (bron: blueprint v2.19.18 pseudocode + v2.25.28/v2.25.29).
 * Dé centrale plek die bepaalt of een gebruiker een functie mag gebruiken —
 * "één regel voor Premium" (v2.19.19). Premium-status wordt nooit vertrouwd
 * vanuit de app; alleen deze service beslist (v2.19.22).
 *
 * Deze service leest alleen: bij verlopen Premium wordt nooit data
 * verwijderd, de functie gaat enkel dicht (v2.19.10).
 */
@Injectable()
export class FeatureAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async canUse(userId: string, featureKey: FeatureKey, now: Date = new Date()): Promise<boolean> {
    const feature = await this.prisma.feature.findUnique({
      where: { featureKey },
      select: FEATURE_SELECT,
    });

    if (!feature || !feature.active) {
      return false;
    }

    const plan = await this.getEffectivePlan(userId, now);
    return isEnabledFor(feature, plan);
  }

  /**
   * Fase 6, stap 2 (v2.19.7): het volledige overzicht voor `GET /features`,
   * zodat de app weet wat hij kan tonen. Dit is alleen informatie voor de
   * UI — de backend blijft elke Premium-aanvraag zelf via `canUse` checken
   * (v2.19.8), wat de app ook beweert.
   */
  async getFeatureAccess(userId: string, now: Date = new Date()): Promise<FeatureAccessReport> {
    const [plan, rows] = await Promise.all([
      this.getEffectivePlan(userId, now),
      this.prisma.feature.findMany({ select: { featureKey: true, ...FEATURE_SELECT } }),
    ]);
    const byKey = new Map(rows.map((row) => [row.featureKey, row]));

    // Altijd elke bekende sleutel in het antwoord (ook als hij niet geseed
    // is → false), zodat de app nooit op een ontbrekende sleutel stuit.
    const features = Object.fromEntries(
      (Object.keys(FEATURES) as FeatureKey[]).map((key) => {
        const feature = byKey.get(key);
        return [key, feature !== undefined && isEnabledFor(feature, plan)];
      }),
    ) as Record<FeatureKey, boolean>;

    return { plan, features };
  }

  /** Het plan dat nú geldt, afgeleid uit de meest recente abonnement-rij. */
  async getEffectivePlan(userId: string, now: Date = new Date()): Promise<SubscriptionPlan> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      select: { plan: true, status: true, expiresAt: true },
    });

    return subscription && hasPremiumAccess(subscription, now)
      ? SubscriptionPlan.PREMIUM
      : SubscriptionPlan.FREE;
  }
}

// Globaal uitgeschakelde functie → dicht, ook voor Premium (FA-011). Veilige
// standaard: liever een functie te weinig dan per ongeluk Premium gratis.
function isEnabledFor(feature: FeatureSnapshot, plan: SubscriptionPlan): boolean {
  return feature.active && feature.planFeatures.some((pf) => pf.plan === plan && pf.enabled);
}

function hasPremiumAccess(subscription: SubscriptionSnapshot, now: Date): boolean {
  if (subscription.plan !== SubscriptionPlan.PREMIUM) {
    return false;
  }

  const notExpired = subscription.expiresAt !== null && subscription.expiresAt > now;

  switch (subscription.status) {
    // Een lopend abonnement zonder einddatum blijft geldig; met einddatum tot
    // die datum (ook als niemand de status op EXPIRED heeft gezet).
    case SubscriptionStatus.ACTIVE:
      return subscription.expiresAt === null || notExpired;
    // Proefperiode en opgezegd abonnement: alleen tot de einddatum (v2.19.9,
    // FA-004/FA-006). Zonder einddatum geen toegang — een trial of opzegging
    // zonder eind zou stilletjes permanent Premium worden.
    case SubscriptionStatus.TRIAL:
    case SubscriptionStatus.CANCELLED:
      return notExpired;
    case SubscriptionStatus.EXPIRED:
      return false;
  }
}
