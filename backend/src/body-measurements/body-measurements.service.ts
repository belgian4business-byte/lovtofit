import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const TREND_DIRECTIONS = ['DOWN', 'UP', 'STABLE'] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];

// Minder metingen dan dit levert geen betrouwbare trend op — dan is er
// simpelweg te weinig om een eerste helft met een tweede te vergelijken
// (blueprint v2.17.12: "Insufficient Data" i.p.v. verzonnen precisie).
const MIN_MEASUREMENTS_FOR_TREND = 3;

// Onder dit verschil (in kg, tussen het gemiddelde van de oudere en de
// recentere helft van de metingen) noemen we het "stabiel" — dagelijkse
// schommeling mag nooit als een trend worden gelezen (blueprint v2.17.4).
const TREND_THRESHOLD_KG = 0.3;

export interface WeightMeasurementEntry {
  weightKg: number;
  measuredAt: Date;
}

export interface WeightTrendReport {
  status: 'INSUFFICIENT_DATA' | 'HAS_TREND';
  measurementCount: number;
  latestWeightKg: number | null;
  direction: TrendDirection | null;
  /** Nieuwste eerst, voor weergave — zelfde volgorde als andere geschiedenislijsten. */
  history: WeightMeasurementEntry[];
}

/**
 * Fase 5 (bron: blueprint v1.3 §6 / v2.17.4 + v2.17.12). Stap 1: elke
 * meting is een nieuwe rij, nooit een update — zo bewaren we de
 * geschiedenis die stap 2 nodig heeft. Stap 2: een simpele Trend Engine
 * v1 ("begin simpel, maak later slim" — CLAUDE.md) die de oudste en de
 * recentste helft van de metingen vergelijkt in plaats van naar één losse
 * meting te kijken ("gewicht is een trend, geen dagelijkse beoordeling").
 */
@Injectable()
export class BodyMeasurementsService {
  constructor(private readonly prisma: PrismaService) {}

  async logWeight(userId: string, weightKg: number) {
    return this.prisma.bodyMeasurement.create({
      data: { userId, weightKg },
    });
  }

  async getTrend(userId: string): Promise<WeightTrendReport> {
    const measurements = await this.prisma.bodyMeasurement.findMany({
      where: { userId },
      orderBy: { measuredAt: 'asc' },
      select: { weightKg: true, measuredAt: true },
    });

    const measurementCount = measurements.length;
    const latestWeightKg =
      measurementCount > 0 ? measurements[measurementCount - 1].weightKg : null;
    const history = [...measurements].reverse();

    if (measurementCount < MIN_MEASUREMENTS_FOR_TREND) {
      return { status: 'INSUFFICIENT_DATA', measurementCount, latestWeightKg, direction: null, history };
    }

    const half = Math.floor(measurementCount / 2);
    const olderHalf = measurements.slice(0, half);
    const recentHalf = measurements.slice(half);
    const average = (entries: WeightMeasurementEntry[]) =>
      entries.reduce((sum, entry) => sum + entry.weightKg, 0) / entries.length;
    const diff = average(recentHalf) - average(olderHalf);

    let direction: TrendDirection;
    if (diff <= -TREND_THRESHOLD_KG) direction = 'DOWN';
    else if (diff >= TREND_THRESHOLD_KG) direction = 'UP';
    else direction = 'STABLE';

    return { status: 'HAS_TREND', measurementCount, latestWeightKg, direction, history };
  }
}
