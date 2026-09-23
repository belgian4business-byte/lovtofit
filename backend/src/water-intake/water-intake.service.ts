import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Praktische richtwaarde, geen medische norm (blueprint v1.3 §10 /
// v2.17.7: "geen absurde 'iedereen moet exact 3,7 liter drinken'"). Als er
// nog geen gewicht bekend is, valt de engine terug op een simpel vast
// doel — begin simpel, maak later slim (bv. activiteit/warmte meewegen).
const DEFAULT_TARGET_ML = 2000;
const ML_PER_KG = 30;
const GLASS_ML = 250;

export interface WaterStatus {
  totalMl: number;
  targetMl: number;
  remainingMl: number;
}

function computeTargetMl(latestWeightKg: number | null): number {
  if (latestWeightKg == null) return DEFAULT_TARGET_ML;
  // Afgerond op een glas (geen schijnprecisie zoals "1.847 ml").
  return Math.round((latestWeightKg * ML_PER_KG) / GLASS_ML) * GLASS_ML;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Fase 5, stap 3 (bron: blueprint v1.3 §10 / v2.17.7). Elke registratie is
 * een losse rij (net als BodyMeasurement) — "vandaag" is simpelweg de som
 * van de rijen van vandaag, geen apart bijgehouden totaal dat uit de pas
 * kan raken.
 */
@Injectable()
export class WaterIntakeService {
  constructor(private readonly prisma: PrismaService) {}

  async logIntake(userId: string, amountMl: number) {
    return this.prisma.waterIntake.create({ data: { userId, amountMl } });
  }

  async getTodayStatus(userId: string): Promise<WaterStatus> {
    const [entries, latestMeasurement] = await Promise.all([
      this.prisma.waterIntake.findMany({
        where: { userId, loggedAt: { gte: startOfTodayUtc() } },
        select: { amountMl: true },
      }),
      this.prisma.bodyMeasurement.findFirst({
        where: { userId },
        orderBy: { measuredAt: 'desc' },
        select: { weightKg: true },
      }),
    ]);

    const totalMl = entries.reduce((sum, entry) => sum + entry.amountMl, 0);
    const targetMl = computeTargetMl(latestMeasurement?.weightKg ?? null);
    const remainingMl = Math.max(0, targetMl - totalMl);

    return { totalMl, targetMl, remainingMl };
  }
}
