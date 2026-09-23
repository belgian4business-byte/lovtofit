import { describe, expect, it } from 'vitest';
import { RuleGuardService } from '../rule-guard/rule-guard.service.js';
import { addDays, buildWeekSchedule, toLocalDate, weekdayOf, type WeekSchedule } from './week-schedule.js';

// Week van maandag 21 t/m zondag 27 september 2026.
const MON = '2026-09-21';
const TUE = '2026-09-22';
const WED = '2026-09-23';
const THU = '2026-09-24';
const FRI = '2026-09-25';
const SAT = '2026-09-26';
const PREV_SUN = '2026-09-20';

function week(input: {
  today: string;
  sessions?: string[];
  frequency?: number;
  premium?: boolean;
  planStartDate?: string;
}): WeekSchedule {
  return buildWeekSchedule({
    today: input.today,
    weeklyFrequency: input.frequency ?? 3,
    planStartDate: input.planStartDate ?? '2026-01-01',
    sessionDates: input.sessions ?? [],
    canUseSmartReschedule: input.premium ?? true,
  });
}

const statuses = (schedule: WeekSchedule) => schedule.days.map((d) => d.status);

describe('buildWeekSchedule', () => {
  it('standaardschema: 3×/week = ma/wo/vr, niets gemist, niets herpland', () => {
    const result = week({ today: MON });

    expect(result.plannedWeekdays).toEqual(['MON', 'WED', 'FRI']);
    expect(statuses(result)).toEqual(['PLANNED', 'REST', 'PLANNED', 'REST', 'PLANNED', 'REST', 'REST']);
    expect(result.missedCount).toBe(0);
    expect(result.smartReschedule).toBe('NOT_NEEDED');
  });

  it('woensdag gemist (Premium): vandaag oppakken, rustdag ertussen, niets gestapeld', () => {
    const result = week({ today: THU, sessions: [MON] });

    expect(statuses(result)).toEqual(['DONE', 'REST', 'MISSED', 'PLANNED', 'REST', 'PLANNED', 'REST']);
    expect(result.missedCount).toBe(1);
    expect(result.remainingThisWeek).toBe(2);
    expect(result.droppedTrainings).toBe(0);
    expect(result.smartReschedule).toBe('APPLIED');
  });

  it('woensdag gemist (Free): volgende geplande training staat klaar, de gemiste valt weg', () => {
    const result = week({ today: THU, sessions: [MON], premium: false });

    expect(statuses(result)).toEqual(['DONE', 'REST', 'MISSED', 'REST', 'PLANNED', 'REST', 'REST']);
    expect(result.droppedTrainings).toBe(1);
    expect(result.smartReschedule).toBe('PREMIUM_REQUIRED');
  });

  it('een dag later trainen is niet gemist; de week schuift mee zonder twee dagen na elkaar', () => {
    const result = week({ today: WED, sessions: [TUE] });

    expect(result.missedCount).toBe(0);
    expect(statuses(result)).toEqual(['REST', 'DONE', 'REST', 'PLANNED', 'REST', 'PLANNED', 'REST']);
    expect(result.smartReschedule).toBe('APPLIED');
  });

  it('Free: geen Premium-teaser als er niets gemist is, ook al past het schema niet meer helemaal', () => {
    const result = week({ today: WED, sessions: [TUE], premium: false });

    expect(result.missedCount).toBe(0);
    expect(statuses(result)).toEqual(['REST', 'DONE', 'REST', 'REST', 'PLANNED', 'REST', 'REST']);
    expect(result.droppedTrainings).toBe(1);
    expect(result.smartReschedule).toBe('NOT_NEEDED');
  });

  it('nooit stapelen: alles gemist op zaterdag → één training, de rest valt weg (geen schuld)', () => {
    const result = week({ today: SAT });

    expect(statuses(result)).toEqual(['MISSED', 'REST', 'MISSED', 'REST', 'MISSED', 'PLANNED', 'REST']);
    expect(result.missedCount).toBe(3);
    expect(result.droppedTrainings).toBe(2);
  });

  it('vandaag al getraind: niets meer vandaag, en morgen niet meteen weer', () => {
    const result = week({ today: THU, sessions: [MON, THU] });

    expect(statuses(result)).toEqual(['DONE', 'REST', 'MISSED', 'DONE', 'REST', 'PLANNED', 'REST']);
    expect(result.remainingThisWeek).toBe(1);
  });

  it('herstel over de weekgrens: na een training op zondag niet meteen maandag', () => {
    const result = week({ today: MON, sessions: [PREV_SUN] });

    expect(result.trainingDaysBeforeWeek).toBe(1);
    expect(result.days[0].status).toBe('REST');
    expect(result.days.filter((d) => d.status === 'PLANNED')).toHaveLength(3);
  });

  it('eerste week: geplande dagen van vóór de onboarding zijn nooit gemist', () => {
    const result = week({ today: THU, planStartDate: THU });

    expect(result.missedCount).toBe(0);
    expect(result.weeklyTarget).toBe(1);
    expect(statuses(result)).toEqual(['REST', 'REST', 'REST', 'REST', 'PLANNED', 'REST', 'REST']);
  });

  it('5×/week mag dagen na elkaar, zoals het eigen schema (max. 3)', () => {
    const result = week({ today: MON, frequency: 5 });

    expect(result.maxConsecutiveTrainingDays).toBe(3);
    expect(statuses(result)).toEqual(['PLANNED', 'PLANNED', 'PLANNED', 'REST', 'PLANNED', 'PLANNED', 'REST']);
  });

  it('weekdoel al gehaald: niets meer gepland, extra trainingen zijn prima', () => {
    const result = week({ today: FRI, sessions: [MON, TUE, WED, THU] });

    expect(result.remainingThisWeek).toBe(0);
    expect(result.days.some((d) => d.status === 'PLANNED')).toBe(false);
    expect(result.smartReschedule).toBe('NOT_NEEDED');
  });
});

describe('datums (tijdzone Europe/Brussels, zomer-/wintertijd)', () => {
  it('23:30 UTC is in België al de volgende dag', () => {
    expect(toLocalDate(new Date('2026-09-23T22:30:00Z'))).toBe(THU);
  });

  it('dagen optellen over de overgang naar wintertijd verschuift niets', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(weekdayOf('2026-10-26')).toBe('MON');
  });
});

describe('elke gegenereerde planning komt door de Rule Guard', () => {
  it('alle frequenties × alle dagen × alle combinaties van sessies × Free/Premium', () => {
    const ruleGuard = new RuleGuardService();
    const days = [PREV_SUN, ...Array.from({ length: 7 }, (_, i) => addDays(MON, i))];

    for (let frequency = 2; frequency <= 6; frequency++) {
      for (let t = 1; t < days.length; t++) {
        const today = days[t];
        // Elke combinatie van sessies op de dagen t/m vandaag.
        for (let mask = 0; mask < 1 << (t + 1); mask++) {
          const sessions = days.slice(0, t + 1).filter((_, i) => mask & (1 << i));
          for (const premium of [false, true]) {
            const schedule = week({ today, sessions, frequency, premium });
            const result = ruleGuard.checkSchedule(schedule);
            expect(result.violations, JSON.stringify({ frequency, today, sessions, premium })).toEqual([]);
            expect(schedule.days.filter((d) => d.status === 'PLANNED').length + schedule.droppedTrainings).toBe(
              schedule.remainingThisWeek,
            );
          }
        }
      }
    }
  });
});
