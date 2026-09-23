import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AiCoachService } from '../ai-coach/ai-coach.service.js';
import { FeatureAccessService } from '../feature-access/feature-access.service.js';
import { MotivationEngineService } from '../motivation-engine/motivation-engine.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RuleGuardService } from '../rule-guard/rule-guard.service.js';
import { buildWeekSchedule, toLocalDate, type WeekSchedule } from './week-schedule.js';

// Genoeg om de hele lopende week én de reeks trainingsdagen vlak vóór
// maandag te zien (herstelregel over de weekgrens heen).
const LOOKBACK_DAYS = 14;

export interface WeekScheduleWithCoach extends WeekSchedule {
  /** Stap 2: vriendelijke uitleg na een gemiste training; null = niets te melden. */
  coachMessage: string | null;
}

/**
 * Weekplanning + Smart Reschedule (CLAUDE.md Fase 9, stap 1). Haalt de data
 * op, laat `buildWeekSchedule` de planning maken en de Rule Guard die
 * onafhankelijk controleren (v2.32.12). Pas daarna legt de AI Coach de al
 * gecontroleerde planning uit (stap 2: "De Engines beslissen. De AI legt
 * uit.").
 *
 * Er wordt niets opgeslagen: de planning wordt bij elke aanvraag opnieuw
 * berekend uit wat er echt gedaan is. Mist de gebruiker ook de herplande
 * dag, dan schuift de planning gewoon opnieuw mee — zonder schuld.
 */
@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureAccess: FeatureAccessService,
    private readonly ruleGuard: RuleGuardService,
    private readonly motivationEngine: MotivationEngineService,
    private readonly aiCoach: AiCoachService,
  ) {}

  async getWeek(userId: string, now: Date = new Date()): Promise<WeekScheduleWithCoach> {
    const preferences = await this.prisma.trainingPreferences.findUnique({ where: { userId } });
    if (!preferences) {
      throw new NotFoundException('Onboarding nog niet afgerond');
    }

    const [sessions, canUseSmartReschedule] = await Promise.all([
      this.prisma.workoutSession.findMany({
        where: { userId, completedAt: { gte: new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) } },
        select: { completedAt: true },
      }),
      this.featureAccess.canUse(userId, 'CAN_USE_SMART_RESCHEDULE', now),
    ]);

    const schedule = buildWeekSchedule({
      today: toLocalDate(now),
      weeklyFrequency: preferences.weeklyFrequency,
      planStartDate: toLocalDate(preferences.createdAt),
      sessionDates: sessions.map((s) => toLocalDate(s.completedAt)),
      canUseSmartReschedule,
    });

    const result = this.ruleGuard.checkSchedule(schedule);
    if (!result.passed) {
      // Zelfde houding als bij workouts: beter luid falen dan stilzwijgend
      // een planning met trainingsschuld of zonder herstel serveren.
      throw new InternalServerErrorException(`Rule Guard blokkeerde deze planning: ${result.violations.join(' | ')}`);
    }

    const motivation = await this.motivationEngine.getStatus(userId);
    return {
      ...schedule,
      coachMessage: this.aiCoach.explainSchedule({ motivationSignal: motivation.signal, schedule }),
    };
  }
}
