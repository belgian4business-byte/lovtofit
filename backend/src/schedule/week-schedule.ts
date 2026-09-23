// Weekplanning + Smart Reschedule (CLAUDE.md Fase 9, stap 1; bron: blueprint
// v0.2 §18, v0.3 §13, v0.7.12, v0.9.15, v1.1.8, v1.4 §4, v1.9 §25, v2.16.6,
// v2.32.12). Pure functies, geen database: makkelijk te testen en
// deterministisch.
//
// Er is (nog) geen opgeslagen dag-voor-dag planning. Het "plan" is een vast
// standaardschema afgeleid uit `weeklyFrequency` (bewuste keuze, Fase 9).
// Zelf dagen kiezen kan later; dan vervangt dat alleen DEFAULT_TRAINING_DAYS.

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

// weeklyFrequency is 2-6 (onboarding-DTO). Zo gespreid dat er waar mogelijk
// een rustdag tussen zit (v0.3 §11: Ma/Wo/Vr).
export const DEFAULT_TRAINING_DAYS: Record<number, readonly Weekday[]> = {
  2: ['MON', 'THU'],
  3: ['MON', 'WED', 'FRI'],
  4: ['MON', 'TUE', 'THU', 'FRI'],
  5: ['MON', 'TUE', 'WED', 'FRI', 'SAT'],
  6: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
};

// Vaste app-tijdzone tot er een tijdzone per gebruiker bestaat (v2.32.16).
// "Vandaag" en "deze week" zijn lokale kalenderdagen, niet UTC.
export const APP_TIME_ZONE = 'Europe/Brussels';

export type DayStatus = 'DONE' | 'MISSED' | 'PLANNED' | 'REST';

export interface ScheduleDay {
  date: string; // YYYY-MM-DD, lokale datum
  weekday: Weekday;
  status: DayStatus;
  isToday: boolean;
  /** Aantal afgeronde sessies op deze dag (0 bij MISSED/PLANNED/REST). */
  sessionCount: number;
}

export type SmartRescheduleStatus = 'NOT_NEEDED' | 'APPLIED' | 'PREMIUM_REQUIRED';

export interface WeekSchedule {
  weekStart: string;
  today: string;
  /** weeklyFrequency, of minder in de week waarin de gebruiker begon. */
  weeklyTarget: number;
  /** Het standaardschema waartegen "gemist" bepaald wordt. */
  plannedWeekdays: Weekday[];
  /** Maximaal aantal trainingsdagen na elkaar, afgeleid uit het schema. */
  maxConsecutiveTrainingDays: number;
  completedThisWeek: number;
  missedCount: number;
  remainingThisWeek: number;
  /**
   * Trainingen die deze week niet meer passen zonder te stapelen of herstel
   * te negeren. Ze vallen gewoon weg — geen trainingsschuld (v0.9.19 regel 5).
   */
  droppedTrainings: number;
  smartReschedule: SmartRescheduleStatus;
  /** Aaneengesloten trainingsdagen direct vóór maandag (voor de herstelregel). */
  trainingDaysBeforeWeek: number;
  days: ScheduleDay[];
}

export function toLocalDate(instant: Date, timeZone: string = APP_TIME_ZONE): string {
  // en-CA geeft YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    instant,
  );
}

// Datumrekenen op de kalenderdatum zelf (UTC-middag als anker), zodat
// zomer-/wintertijd nooit een dag verschuift (v2.32.17).
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): Weekday {
  const jsDay = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = zondag
  return WEEKDAYS[(jsDay + 6) % 7];
}

export function mondayOf(date: string): string {
  return addDays(date, -WEEKDAYS.indexOf(weekdayOf(date)));
}

export function maxConsecutive(weekdays: readonly Weekday[]): number {
  let best = 0;
  let run = 0;
  for (const day of WEEKDAYS) {
    run = weekdays.includes(day) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * Berekent de week van de gebruiker: wat er gedaan is, wat gemist is, en wat
 * er de rest van de week gepland staat.
 *
 * - Gemist = er zijn vóór vandaag minder sessies gedaan dan er geplande dagen
 *   voorbij zijn. Een training een dag later doen telt dus niet als gemist.
 *   Een rustdag is nooit gemist (v1.4 §3).
 * - Nooit stapelen (v2.16.6 / RG08): maximaal één training per dag, nooit meer
 *   trainingen dan het weekdoel, geen dubbele training om iets "in te halen".
 * - Herstel: nooit meer trainingsdagen na elkaar dan het eigen schema van de
 *   gebruiker (bv. 3×/week → altijd een rustdag ertussen). Wat de training op
 *   die dag zelf bevat, blijft de Decision Engine bepalen (recovery-aware).
 * - Zonder Premium (v1.1.8: Free = "je volgende geplande training staat
 *   klaar"), of als er niets te herplannen valt, blijft het standaardschema
 *   staan. Met Premium verdeelt Smart Reschedule na een gemiste training (of
 *   als het standaardschema niet meer past) de resterende trainingen over
 *   alle resterende dagen, vanaf vandaag.
 */
export function buildWeekSchedule(input: {
  today: string;
  weeklyFrequency: number;
  /**
   * Lokale datum van de onboarding. Geplande dagen daarvóór bestonden voor
   * deze gebruiker nog niet: die zijn nooit gemist en tellen niet mee.
   */
  planStartDate: string;
  /** Lokale datums van afgeronde sessies (één item per sessie). */
  sessionDates: string[];
  canUseSmartReschedule: boolean;
}): WeekSchedule {
  const { today, weeklyFrequency, planStartDate, sessionDates, canUseSmartReschedule } = input;
  const plannedWeekdays = [...(DEFAULT_TRAINING_DAYS[weeklyFrequency] ?? DEFAULT_TRAINING_DAYS[3])];
  const maxRun = maxConsecutive(plannedWeekdays);
  const weekStart = mondayOf(today);
  const weekDates = WEEKDAYS.map((_, i) => addDays(weekStart, i));
  const isPlanned = (date: string) => date >= planStartDate && plannedWeekdays.includes(weekdayOf(date));
  const weeklyTarget = Math.min(weeklyFrequency, weekDates.filter(isPlanned).length);

  const sessionsOn = new Map<string, number>();
  for (const date of sessionDates) {
    sessionsOn.set(date, (sessionsOn.get(date) ?? 0) + 1);
  }
  const count = (date: string) => sessionsOn.get(date) ?? 0;

  const pastDates = weekDates.filter((d) => d < today);
  const completedThisWeek = weekDates.reduce((sum, d) => sum + count(d), 0);
  const plannedBeforeToday = pastDates.filter(isPlanned).length;
  const sessionsBeforeToday = pastDates.reduce((sum, d) => sum + count(d), 0);
  const missedCount = Math.max(0, plannedBeforeToday - sessionsBeforeToday);

  // De meest recente geplande dagen zonder sessie krijgen het label MISSED;
  // oudere zijn "ingehaald" door een latere extra sessie en tellen als rust.
  // (Er zijn altijd minstens missedCount zulke dagen.)
  const uncoveredPlannedDates = pastDates.filter((d) => isPlanned(d) && count(d) === 0);
  const missedDates = new Set(missedCount > 0 ? uncoveredPlannedDates.slice(-missedCount) : []);

  let trainingDaysBeforeWeek = 0;
  while (count(addDays(weekStart, -trainingDaysBeforeWeek - 1)) > 0) {
    trainingDaysBeforeWeek++;
  }

  const remainingThisWeek = Math.max(0, weeklyTarget - completedThisWeek);
  const firstOpenDate = count(today) > 0 ? addDays(today, 1) : today;
  const openDates = weekDates.filter((d) => d >= firstOpenDate);

  // Chronologisch (vandaag eerst: "we pakken vandaag op"), elke dag hooguit
  // één training, en nooit een reeks langer dan het eigen schema.
  const place = (candidates: string[]): Set<string> => {
    const trainingDates = new Set(sessionsOn.keys());
    const chosen = new Set<string>();
    for (const date of candidates) {
      if (chosen.size >= remainingThisWeek) break;
      let run = 1;
      while (trainingDates.has(addDays(date, -run))) run++;
      if (run > maxRun) continue;
      chosen.add(date);
      trainingDates.add(date);
    }
    return chosen;
  };

  // Herplannen is nodig bij een gemiste training, maar ook als het
  // standaardschema de resterende trainingen niet meer kwijt kan (bv. een
  // dag later getraind, waardoor de volgende geplande dag te vlak erna komt).
  // Free ziet de Premium-teaser alleen na een échte gemiste training (v1.9
  // §25); past het schema gewoon niet meer, dan blijft het bij het
  // standaardschema, zonder teaser.
  let planned = place(openDates.filter(isPlanned));
  let smartReschedule: SmartRescheduleStatus = 'NOT_NEEDED';
  if (canUseSmartReschedule && (missedCount > 0 || planned.size < remainingThisWeek)) {
    smartReschedule = 'APPLIED';
    planned = place(openDates);
  } else if (missedCount > 0) {
    smartReschedule = 'PREMIUM_REQUIRED';
  }

  const days: ScheduleDay[] = weekDates.map((date) => {
    let status: DayStatus = 'REST';
    if (count(date) > 0) status = 'DONE';
    else if (missedDates.has(date)) status = 'MISSED';
    else if (planned.has(date)) status = 'PLANNED';
    return { date, weekday: weekdayOf(date), status, isToday: date === today, sessionCount: count(date) };
  });

  return {
    weekStart,
    today,
    weeklyTarget,
    plannedWeekdays,
    maxConsecutiveTrainingDays: maxRun,
    completedThisWeek,
    missedCount,
    remainingThisWeek,
    droppedTrainings: remainingThisWeek - planned.size,
    smartReschedule,
    trainingDaysBeforeWeek,
    days,
  };
}
