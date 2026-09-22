import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const MOTIVATION_SIGNALS = [
  'RETURN_AFTER_ABSENCE',
  'MILESTONE_REACHED',
  'CONSISTENCY_GOOD',
  'CONSISTENCY_DECLINING',
  'AT_RISK_OF_DROPOUT',
  'NORMAL',
] as const;
export type MotivationSignal = (typeof MOTIVATION_SIGNALS)[number];

const MILESTONES = [1, 5, 10, 25, 50, 100];
const ABSENCE_THRESHOLD_DAYS = 14;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface MotivationStatus {
  signal: MotivationSignal;
  /** Aantal opeenvolgende weken dat de gebruiker zijn eigen weekdoel haalde. */
  consistencyStreakWeeks: number;
  weeklyTarget: number;
  completedThisWeek: number;
  totalSessionsCompleted: number;
  /** Alleen gezet als signal === MILESTONE_REACHED. */
  milestone: number | null;
  daysSinceLastSession: number | null;
}

/**
 * Motivation Engine (CLAUDE.md Fase 3, stap 6; bron: blueprint v1.2 +
 * v2.16). Analyseert gedrag en levert een gecontroleerd signaal — geen
 * teksten. De (latere) AI Coach vertaalt dit signaal naar menselijke
 * communicatie (v2.16.15: "De Engine levert het feitelijke signaal. AI
 * verzorgt de menselijke communicatie.").
 *
 * Kernprincipe: consistency over perfection, nooit alles-of-niets
 * (v1.2). We hebben nog geen dag-voor-dag weekplanning (die is bewust
 * uitgesteld, zie Decision Engine stap 4), dus de "plan" waarmee we
 * vergelijken is `weeklyFrequency` uit onboarding: haalde de gebruiker
 * deze week zijn eigen aantal trainingen? Dat sluit vanzelf uit dat een
 * los gemiste dág de streak breekt — we kijken nooit naar losse dagen,
 * enkel naar de week als geheel (v2.16.4: "Planned Activity Streak").
 *
 * Mag NOOIT (v2.16.18): schuldgevoel, beschamen, straffen, training
 * debt, obsessieve notificaties, vergelijken met anderen — vandaar dat
 * dit engine puur signalen berekent, geen boodschappen.
 */
@Injectable()
export class MotivationEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string): Promise<MotivationStatus> {
    const preferences = await this.prisma.trainingPreferences.findUnique({ where: { userId } });
    if (!preferences) {
      throw new NotFoundException('Onboarding nog niet afgerond');
    }

    const sessions = await this.prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    const weeklyTarget = preferences.weeklyFrequency;
    const totalSessionsCompleted = sessions.length;
    const now = Date.now();

    if (totalSessionsCompleted === 0) {
      return {
        signal: 'NORMAL',
        consistencyStreakWeeks: 0,
        weeklyTarget,
        completedThisWeek: 0,
        totalSessionsCompleted: 0,
        milestone: null,
        daysSinceLastSession: null,
      };
    }

    const daysSinceLastSession = Math.floor(
      (now - sessions[0].completedAt.getTime()) / (24 * 60 * 60 * 1000),
    );

    const weekCount = (weeksAgo: number) => {
      const end = now - weeksAgo * WEEK_MS;
      const start = end - WEEK_MS;
      // Bovengrens inclusief (i.p.v. exclusief): twee Date.now()-aanroepen
      // kunnen dezelfde milliseconde teruggeven, waardoor een sessie van
      // "nu" anders net buiten de huidige week zou vallen.
      return sessions.filter((s) => {
        const t = s.completedAt.getTime();
        return t > start && t <= end;
      }).length;
    };

    const completedThisWeek = weekCount(0);
    const consistencyStreakWeeks = this.calculateStreak(weekCount, weeklyTarget);
    const justReachedMilestone = MILESTONES.includes(totalSessionsCompleted)
      ? totalSessionsCompleted
      : null;

    // Volgorde volgt de pseudocode uit blueprint v2.16.16. Belangrijke
    // nuance t.o.v. de blueprint: de huidige week (week 0) loopt nog, dus
    // die vergelijken we nooit voor een "dalende" trend — dat zou een
    // week die simpelweg nog niet voorbij is oneerlijk als achteruitgang
    // bestempelen. Week 0 telt alleen mee voor het positieve
    // "doel al gehaald"-signaal; dalingsdetectie gebruikt uitsluitend
    // volledig afgeronde weken (1, 2, 3).
    let signal: MotivationSignal;
    if (daysSinceLastSession >= ABSENCE_THRESHOLD_DAYS) {
      signal = 'RETURN_AFTER_ABSENCE';
    } else if (justReachedMilestone !== null) {
      signal = 'MILESTONE_REACHED';
    } else if (completedThisWeek >= weeklyTarget) {
      signal = 'CONSISTENCY_GOOD';
    } else if (weekCount(1) < weeklyTarget && weekCount(2) < weeklyTarget && weekCount(3) < weeklyTarget) {
      // Trend > moment (v0.8.6/v2.14.3): pas na meerdere volledige zwakke
      // weken op rij spreken we van een risico, nooit na één mindere week.
      signal = 'AT_RISK_OF_DROPOUT';
    } else if (weekCount(1) < weekCount(2)) {
      signal = 'CONSISTENCY_DECLINING';
    } else {
      signal = 'NORMAL';
    }

    return {
      signal,
      consistencyStreakWeeks,
      weeklyTarget,
      completedThisWeek,
      totalSessionsCompleted,
      milestone: signal === 'MILESTONE_REACHED' ? justReachedMilestone : null,
      daysSinceLastSession,
    };
  }

  private calculateStreak(weekCount: (weeksAgo: number) => number, weeklyTarget: number): number {
    let streak = 0;
    // Praktische bovengrens (2 jaar) zodat dit nooit oneindig doorloopt.
    for (let weeksAgo = 0; weeksAgo < 104; weeksAgo++) {
      if (weekCount(weeksAgo) >= weeklyTarget) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }
}
