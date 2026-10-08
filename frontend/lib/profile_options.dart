/// De keuzes uit de onboarding: Nederlands label → API-waarde. Eén plek,
/// zodat de onboarding en het profiel-scherm dezelfde teksten tonen.
library;

const goalOptions = {
  'Afvallen': 'LOSE_WEIGHT',
  'Spieren opbouwen': 'BUILD_MUSCLE',
  'Sterker worden': 'GET_STRONGER',
  'Conditie verbeteren': 'IMPROVE_CONDITION',
  'Fit worden': 'GET_FIT',
};

// Buiten (OUTDOOR) sinds Fase 13: alleen bodyweight, geen gym-apparaten;
// buitenoefeningen zoals hardlopen en sprints mogen.
const locationOptions = {'🏠 Thuis': 'HOME', '🏋️ Fitness': 'GYM', '🔄 Beide': 'BOTH', '🌳 Buiten': 'OUTDOOR'};

const equipmentOptions = {
  'Geen apparatuur': 'NONE',
  'Dumbbells': 'DUMBBELLS',
  'Elastieken': 'RESISTANCE_BANDS',
  'Kettlebell': 'KETTLEBELL',
  'Volledige fitnessapparatuur': 'FULL_GYM',
};

const durationOptions = {
  '⏱ 15 min': 'MIN_15',
  '⏱ 30 min': 'MIN_30',
  '⏱ 45 min': 'MIN_45',
  '⏱ 60+ min': 'MIN_60_PLUS',
};

const frequencyOptions = {
  '2× per week': 2,
  '3× per week': 3,
  '4× per week': 4,
  '5× per week': 5,
  '6× per week': 6,
};

const levelOptions = {'Beginner': 'BEGINNER', 'Gemiddeld': 'INTERMEDIATE', 'Gevorderd': 'ADVANCED'};

/// Het label bij een API-waarde, of de waarde zelf als die (nog) niet in de
/// keuzes staat (bv. een nieuwe waarde die de backend al kent).
String labelFor<T>(Map<String, T> options, T value) {
  for (final entry in options.entries) {
    if (entry.value == value) return entry.key;
  }
  return '$value';
}

/// "Geen apparatuur" sluit de rest uit (en omgekeerd). Geeft de nieuwe set
/// terug; gedeeld door onboarding en profiel.
Set<String> toggleEquipment(Set<String> current, String value) {
  if (value == 'NONE') return {'NONE'};
  final next = {...current}..remove('NONE');
  if (!next.remove(value)) next.add(value);
  return next;
}

