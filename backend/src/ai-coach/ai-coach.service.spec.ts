import { describe, expect, it } from 'vitest';
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
});
