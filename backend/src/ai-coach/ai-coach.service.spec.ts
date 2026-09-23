import { describe, expect, it } from 'vitest';
import type { MotivationSignal } from '../motivation-engine/motivation-engine.service.js';
import { AiCoachService } from './ai-coach.service.js';

describe('AiCoachService', () => {
  const service = new AiCoachService();

  describe('explainTodaysWorkout', () => {
    it('geeft voorrang aan "welkom terug" na een lange afwezigheid', () => {
      const message = service.explainTodaysWorkout({
        motivationSignal: 'RETURN_AFTER_ABSENCE',
        hasRecentlyLoadedPattern: true,
        hadRecentReplace: true,
      });

      expect(message).toBe('Welkom terug 👋 We beginnen rustig weer op.');
    });

    it('legt uit dat een oefening vervangen is na een pijnmelding', () => {
      const message = service.explainTodaysWorkout({
        motivationSignal: 'NORMAL',
        hasRecentlyLoadedPattern: false,
        hadRecentReplace: true,
      });

      expect(message).toContain('niet lekker voelde');
    });

    it('legt uit dat het vandaag lichter is bij recente belasting', () => {
      const message = service.explainTodaysWorkout({
        motivationSignal: 'NORMAL',
        hasRecentlyLoadedPattern: true,
        hadRecentReplace: false,
      });

      expect(message).toContain('lichter');
    });

    it('verlaagt de drempel bij een dalende consistentie, zonder te beschuldigen', () => {
      const message = service.explainTodaysWorkout({
        motivationSignal: 'AT_RISK_OF_DROPOUT',
        hasRecentlyLoadedPattern: false,
        hadRecentReplace: false,
      });

      expect(message).not.toMatch(/gefaald|slecht|lui/i);
      expect(message).toContain('haalbare training');
    });

    it('geeft een neutrale melding als er niets bijzonders aan de hand is', () => {
      const message = service.explainTodaysWorkout({
        motivationSignal: 'NORMAL',
        hasRecentlyLoadedPattern: false,
        hadRecentReplace: false,
      });

      expect(message).toBe('Hier is je training van vandaag.');
    });
  });

  describe('summarizeCompletedSession', () => {
    it('erkent pijn/ongemak zonder diagnose te stellen', () => {
      const message = service.summarizeCompletedSession({
        exerciseCount: 5,
        setCount: 15,
        hadDiscomfort: true,
        milestone: null,
        hasIncrease: false,
        motivationSignal: 'NORMAL',
      });

      expect(message).toContain('ongemak');
      expect(message).not.toMatch(/blessure|meniscus|diagnose/i);
    });

    it('viert een mijlpaal zonder een cijfer te verzinnen (gebruikt het meegegeven getal)', () => {
      const message = service.summarizeCompletedSession({
        exerciseCount: 5,
        setCount: 15,
        hadDiscomfort: false,
        milestone: 10,
        hasIncrease: false,
        motivationSignal: 'NORMAL',
      });

      expect(message).toContain('10 trainingen');
    });

    it('noemt geen concrete reps/gewicht bij een INCREASE-signaal (geen verzonnen cijfers)', () => {
      const message = service.summarizeCompletedSession({
        exerciseCount: 5,
        setCount: 15,
        hadDiscomfort: false,
        milestone: null,
        hasIncrease: true,
        motivationSignal: 'NORMAL',
      });

      expect(message).toMatch(/ruimte voor een kleine stap/);
      expect(message).not.toMatch(/\d+\s*(kg|reps|herhalingen)/i);
    });

    it('geeft een neutrale samenvatting als er niets bijzonders is', () => {
      const message = service.summarizeCompletedSession({
        exerciseCount: 5,
        setCount: 15,
        hadDiscomfort: false,
        milestone: null,
        hasIncrease: false,
        motivationSignal: 'NORMAL',
      });

      expect(message).toBe('Training voltooid: 5 oefeningen, 15 sets.');
    });

    it('pijn/ongemak krijgt voorrang op een mijlpaal (veiligheid eerst)', () => {
      const message = service.summarizeCompletedSession({
        exerciseCount: 1,
        setCount: 1,
        hadDiscomfort: true,
        milestone: 10,
        hasIncrease: false,
        motivationSignal: 'NORMAL',
      });

      expect(message).toContain('ongemak');
      expect(message).not.toContain('10 trainingen');
    });
  });

  describe('explainProgressionOutcome', () => {
    it('gebruikt het meegegeven reps-getal bij INCREASE, verzint zelf niets', () => {
      const message = service.explainProgressionOutcome('INCREASE', 14);
      expect(message).toContain('14 reps');
    });

    it('gebruikt het meegegeven reps-getal bij DECREASE', () => {
      const message = service.explainProgressionOutcome('DECREASE', 10);
      expect(message).toContain('10 reps');
    });

    it('meldt een andere oefening bij REPLACE, zonder cijfers', () => {
      const message = service.explainProgressionOutcome('REPLACE', 12);
      expect(message).toContain('andere oefening');
      expect(message).not.toMatch(/\d+\s*reps/);
    });

    it('geeft een neutrale melding bij KEEP', () => {
      const message = service.explainProgressionOutcome('KEEP', 12);
      expect(message).toBe('Volgende keer hetzelfde — dat mag.');
    });
  });

  describe('explainMotivationStatus', () => {
    const base = {
      consistencyStreakWeeks: 0,
      weeklyTarget: 3,
      completedThisWeek: 1,
      totalSessionsCompleted: 5,
      milestone: null,
      daysSinceLastSession: 1,
      milestonesReached: [1, 5],
      nextMilestone: 10,
    };

    it('viert een mijlpaal zonder een cijfer te verzinnen (gebruikt het meegegeven getal)', () => {
      const message = service.explainMotivationStatus({
        ...base,
        signal: 'MILESTONE_REACHED',
        milestone: 5,
      });
      expect(message).toContain('5 trainingen');
    });

    it('verwoordt AT_RISK_OF_DROPOUT aanmoedigend, nooit als falen', () => {
      const message = service.explainMotivationStatus({ ...base, signal: 'AT_RISK_OF_DROPOUT' });
      expect(message).not.toMatch(/gefaald|slecht|lui/i);
    });

    it('geeft een neutrale weekstand bij NORMAL', () => {
      const message = service.explainMotivationStatus({ ...base, signal: 'NORMAL' });
      expect(message).toContain('1 van de 3 trainingen');
    });
  });

  describe('explainWeightTrend', () => {
    it('erkent onvoldoende data i.p.v. een trend te verzinnen', () => {
      const message = service.explainWeightTrend('INSUFFICIENT_DATA', null);
      expect(message).toContain('niet genoeg metingen');
    });

    it('verwoordt een dalende trend geruststellend, niet als prestatie-eis', () => {
      const message = service.explainWeightTrend('HAS_TREND', 'DOWN');
      expect(message).toContain('naar beneden');
      expect(message).not.toMatch(/goed gedaan|verdiend/i);
    });

    it('verwoordt een stijgende trend zonder waarde-oordeel', () => {
      const message = service.explainWeightTrend('HAS_TREND', 'UP');
      expect(message).toContain('omhoog');
      expect(message).not.toMatch(/slecht|fout|te veel/i);
    });

    it('geeft een neutrale melding bij een stabiele trend', () => {
      const message = service.explainWeightTrend('HAS_TREND', 'STABLE');
      expect(message).toContain('stabiel');
    });
  });

  describe('explainWaterStatus', () => {
    it('meldt het restant afgerond, geen schijnprecisie', () => {
      const message = service.explainWaterStatus({ totalMl: 1250, targetMl: 2000, remainingMl: 750 });
      expect(message).toContain('750 ml');
    });

    it('rondt naar boven af zodat een klein restant niet als "0 ml" wordt getoond', () => {
      const message = service.explainWaterStatus({ totalMl: 1980, targetMl: 2000, remainingMl: 20 });
      expect(message).toContain('50 ml');
    });

    it('viert het gehaalde doel zonder schuldgevoel-taal elders', () => {
      const message = service.explainWaterStatus({ totalMl: 2000, targetMl: 2000, remainingMl: 0 });
      expect(message).toContain('gehaald');
    });
  });

  describe('explainTodaysWorkout bij lage energie (Fase 8)', () => {
    it('zegt "wat lichter" en brengt het nooit als falen (v2.0 test 08 / v2.4.5)', () => {
      const message = service.explainTodaysWorkout({
        motivationSignal: 'NORMAL',
        hasRecentlyLoadedPattern: false,
        hadRecentReplace: false,
        isLowEnergy: true,
      });

      expect(message).toContain('lichter');
      expect(message).toContain('telt mee');
      expect(message).not.toMatch(/doorzetten|moet/i);
    });
  });

  describe('explainQuickSession', () => {
    it('noemt de geschatte tijd en brengt een korte training nooit als mislukking (v0.8.11)', () => {
      const message = service.explainQuickSession({ estimatedMinutes: 10, exerciseCount: 4, hadRecentReplace: false });

      expect(message).toContain('ongeveer 10 minuten');
      expect(message).toContain('4 belangrijkste bewegingen');
      expect(message).toContain('telt gewoon mee');
    });

    it('legt ook een vervangen oefening (pijn/ongemak) uit', () => {
      const message = service.explainQuickSession({ estimatedMinutes: 14, exerciseCount: 4, hadRecentReplace: true });

      expect(message).toContain('alternatief');
    });

    it('FA-009: legt bij de Premium-gate de waarde uit en benoemt wat gratis blijft', () => {
      const message = service.explainQuickSessionLocked();

      expect(message).toContain('Premium');
      expect(message).toContain('gratis');
      expect(message).not.toMatch(/geweigerd|denied|betaal/i);
    });
  });

  describe('explainCalorieGoal', () => {
    it('erkent onvoldoende data i.p.v. een getal te verzinnen', () => {
      const message = service.explainCalorieGoal({
        status: 'LIMITED_ESTIMATE',
        goalType: 'LOSE_WEIGHT',
        rangeLowKcal: null,
        rangeHighKcal: null,
      });
      expect(message).toContain('nog geen gewicht');
    });

    it('gebruikt de meegegeven range bij LOSE_WEIGHT, geen los magisch getal', () => {
      const message = service.explainCalorieGoal({
        status: 'HAS_RANGE',
        goalType: 'LOSE_WEIGHT',
        rangeLowKcal: 1850,
        rangeHighKcal: 2250,
      });
      expect(message).toContain('1850–2250 kcal');
    });

    it('gebruikt de meegegeven range bij BUILD_MUSCLE en noemt eiwit', () => {
      const message = service.explainCalorieGoal({
        status: 'HAS_RANGE',
        goalType: 'BUILD_MUSCLE',
        rangeLowKcal: 2500,
        rangeHighKcal: 2900,
      });
      expect(message).toContain('2500–2900 kcal');
      expect(message).toContain('eiwit');
    });

    it('FA-009: legt bij PREMIUM_REQUIRED de waarde uit, zonder "geweigerd"-taal en zonder getal', () => {
      const message = service.explainCalorieGoal({
        status: 'PREMIUM_REQUIRED',
        goalType: 'LOSE_WEIGHT',
        rangeLowKcal: null,
        rangeHighKcal: null,
      });
      expect(message).toContain('Premium');
      expect(message).toContain('gratis');
      expect(message).not.toMatch(/kcal|geweigerd|denied/i);
    });
  });

  describe('explainSchedule (Fase 9, Smart Reschedule)', () => {
    // Vandaag = donderdag 24 september 2026.
    const today = '2026-09-24';
    const day = (date: string, status: 'DONE' | 'MISSED' | 'PLANNED' | 'REST') => ({
      date,
      weekday: 'MON' as const,
      status,
      isToday: date === today,
      sessionCount: status === 'DONE' ? 1 : 0,
    });
    const week = (
      smartReschedule: 'NOT_NEEDED' | 'APPLIED' | 'PREMIUM_REQUIRED',
      missedCount: number,
      planned: string[],
    ) => ({
      today,
      missedCount,
      smartReschedule,
      days: [day('2026-09-21', 'DONE'), day('2026-09-23', 'MISSED'), ...planned.map((d) => day(d, 'PLANNED'))],
    });
    const explain = (schedule: ReturnType<typeof week>, motivationSignal: MotivationSignal = 'NORMAL') =>
      service.explainSchedule({ motivationSignal, schedule });

    it('zegt niets als er niets gemist of verschoven is', () => {
      expect(explain(week('NOT_NEEDED', 0, ['2026-09-25']))).toBeNull();
    });

    it('Premium: geen probleem, week aangepast, niets inhalen (vandaag/morgen/weekdag)', () => {
      expect(explain(week('APPLIED', 1, ['2026-09-24', '2026-09-25', '2026-09-27']))).toBe(
        'Geen probleem, we gaan gewoon verder. 💪 Ik heb je week aangepast: je trainingen staan nu gepland voor vandaag, morgen en zondag. Je hoeft niets in te halen.',
      );
    });

    it('Premium: één training over', () => {
      expect(explain(week('APPLIED', 1, ['2026-09-26']))).toContain('je volgende training staat gepland voor zaterdag.');
    });

    it('Premium: niets meer in te plannen deze week → rustig verder volgende week', () => {
      expect(explain(week('APPLIED', 2, []))).toContain('volgende week gaan we gewoon verder');
    });

    it('Premium zonder gemiste training (alleen verschoven voor rust)', () => {
      expect(explain(week('APPLIED', 0, ['2026-09-26']))).toBe(
        'Ik heb je week wat verschoven zodat je genoeg rust krijgt: je volgende training staat gepland voor zaterdag.',
      );
    });

    it('Free: volgende training staat klaar + rustige Premium-teaser', () => {
      expect(explain(week('PREMIUM_REQUIRED', 1, ['2026-09-25']))).toBe(
        'Geen probleem, we gaan gewoon verder. 💪 Je volgende training staat klaar voor morgen. Met Premium plan ik je week automatisch opnieuw, zonder trainingen op elkaar te stapelen.',
      );
    });

    it('na lange afwezigheid: welkom terug', () => {
      expect(explain(week('APPLIED', 1, ['2026-09-24']), 'RETURN_AFTER_ABSENCE')).toMatch(/^Welkom terug 👋/);
    });

    it('nooit bestraffend: geen "gemist", geen aantallen, geen schuld', () => {
      const messages = [
        explain(week('APPLIED', 3, ['2026-09-24'])),
        explain(week('APPLIED', 2, [])),
        explain(week('PREMIUM_REQUIRED', 3, [])),
        explain(week('PREMIUM_REQUIRED', 1, ['2026-09-25']), 'RETURN_AFTER_ABSENCE'),
      ];
      for (const message of messages) {
        expect(message).not.toMatch(/gemist|schuld|\d|achter|moet/i);
      }
    });
  });
});
