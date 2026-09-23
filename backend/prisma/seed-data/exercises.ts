import type { Prisma } from '../../src/generated/prisma/client.js';

/**
 * Kleine startset (~20) uit de blueprint v0.5 Exercise Library.
 * Dekt de movement patterns die de beginner Full Body A/B/C-templates
 * nodig hebben (squat, push, pull, hinge, lunge, core), plus schouders en
 * cardio zodat de 7 hoofdgroepen vertegenwoordigd zijn. Bewust geen
 * isolatie-armoefeningen: de beginner-templates draaien om compound
 * bewegingen (blueprint v0.6, sectie 7).
 *
 * Uitbreiding met de oefeningen waarvoor foto's bestaan
 * (frontend/assets/exercises/): cardio, extra core, wall sit en mobiliteit.
 * Indeling volgens blueprint v0.5 (§3 Superman = rug, §7 bicycle crunch =
 * core-rotatie, §8 cardio incl. "Fitness: Treadmill", §9 mobiliteit =
 * warming-up/cooldown). Totaal nu 35 — ruim binnen de MVP-grens.
 * `location` is standaard ANYWHERE; alleen hardlopen/sprints zijn OUTDOOR.
 */
export const EXERCISES: Prisma.ExerciseCreateInput[] = [
  // Push — borst
  { name: 'Wall Push-up', muscleGroup: 'CHEST', movementPattern: 'PUSH', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Knee Push-up', muscleGroup: 'CHEST', movementPattern: 'PUSH', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Push-up', muscleGroup: 'CHEST', movementPattern: 'PUSH', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE' },
  { name: 'Dumbbell Chest Press', muscleGroup: 'CHEST', movementPattern: 'PUSH', equipment: 'DUMBBELL', level: 'INTERMEDIATE' },

  // Push — schouders
  { name: 'Pike Push-up', muscleGroup: 'SHOULDERS', movementPattern: 'PUSH', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE' },
  { name: 'Dumbbell Shoulder Press', muscleGroup: 'SHOULDERS', movementPattern: 'PUSH', equipment: 'DUMBBELL', level: 'BEGINNER' },

  // Pull — rug
  { name: 'Inverted Row', muscleGroup: 'BACK', movementPattern: 'PULL', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Dumbbell Row', muscleGroup: 'BACK', movementPattern: 'PULL', equipment: 'DUMBBELL', level: 'BEGINNER' },
  { name: 'Lat Pulldown', muscleGroup: 'BACK', movementPattern: 'PULL', equipment: 'MACHINE_CABLE', level: 'BEGINNER' },

  // Squat — benen & billen
  { name: 'Bodyweight Squat', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Goblet Squat', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'DUMBBELL', level: 'BEGINNER' },
  { name: 'Leg Press', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'MACHINE_CABLE', level: 'BEGINNER' },

  // Hinge — benen & billen
  { name: 'Glute Bridge', muscleGroup: 'LEGS_GLUTES', movementPattern: 'HINGE', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Romanian Deadlift', muscleGroup: 'LEGS_GLUTES', movementPattern: 'HINGE', equipment: 'DUMBBELL', level: 'INTERMEDIATE' },

  // Lunge — benen & billen
  { name: 'Reverse Lunge', muscleGroup: 'LEGS_GLUTES', movementPattern: 'LUNGE', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Walking Lunge', muscleGroup: 'LEGS_GLUTES', movementPattern: 'LUNGE', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE' },

  // Core
  { name: 'Plank', muscleGroup: 'CORE', movementPattern: 'CORE_STABILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Dead Bug', muscleGroup: 'CORE', movementPattern: 'CORE_STABILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Side Plank', muscleGroup: 'CORE', movementPattern: 'CORE_STABILITY', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE' },
  { name: 'Superman', muscleGroup: 'BACK', movementPattern: 'CORE_STABILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Bicycle Crunches', muscleGroup: 'CORE', movementPattern: 'ROTATION', equipment: 'BODYWEIGHT', level: 'BEGINNER' },

  // Squat (isometrisch) — benen & billen
  { name: 'Wall Sit', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'BODYWEIGHT', level: 'BEGINNER' },

  // Cardio
  { name: 'Jumping Jacks', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'High Knees', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Mountain Climbers', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Burpees', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE' },
  // Trap op en af: thuis of buiten, overal waar een trap is.
  { name: 'Stair Climbs', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  // Alleen in de fitness (loopband).
  { name: 'Treadmill Intervals', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'TREADMILL', level: 'BEGINNER' },
  // Alleen buiten.
  { name: 'Running Intervals', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'BEGINNER', location: 'OUTDOOR' },
  { name: 'Sprints', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE', location: 'OUTDOOR' },

  // Mobiliteit & herstel (warming-up, cooldown, rustdag — v0.5 §9)
  { name: 'Cat-Cow', muscleGroup: 'MOBILITY', movementPattern: 'MOBILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Downward Dog', muscleGroup: 'MOBILITY', movementPattern: 'MOBILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Hip Circles', muscleGroup: 'MOBILITY', movementPattern: 'MOBILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Standing Forward Fold', muscleGroup: 'MOBILITY', movementPattern: 'MOBILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: "World's Greatest Stretch", muscleGroup: 'MOBILITY', movementPattern: 'MOBILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
];
