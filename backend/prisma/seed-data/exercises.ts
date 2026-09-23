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
 * `imageKey` koppelt een oefening vast aan zijn foto
 * (lovtofit_<imageKey>_<variant>.webp); zonder imageKey toont de app een
 * placeholder. Bewust nog zonder foto: Reverse/Walking Lunge (de foto
 * "lunges" toont een stilstaande lunge) en Dumbbell Chest Press (de foto
 * "bankdrukken" toont een halterstang, geen losse halters).
 */
export const EXERCISES: Prisma.ExerciseCreateInput[] = [
  // Push — borst
  { name: 'Wall Push-up', muscleGroup: 'CHEST', movementPattern: 'PUSH', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Knee Push-up', muscleGroup: 'CHEST', movementPattern: 'PUSH', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Push-up', muscleGroup: 'CHEST', movementPattern: 'PUSH', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE', imageKey: 'push_ups' },
  { name: 'Dumbbell Chest Press', muscleGroup: 'CHEST', movementPattern: 'PUSH', equipment: 'DUMBBELL', level: 'INTERMEDIATE' },

  // Push — schouders
  { name: 'Pike Push-up', muscleGroup: 'SHOULDERS', movementPattern: 'PUSH', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE' },
  { name: 'Dumbbell Shoulder Press', muscleGroup: 'SHOULDERS', movementPattern: 'PUSH', equipment: 'DUMBBELL', level: 'BEGINNER', imageKey: 'schouderpers' },

  // Pull — rug
  { name: 'Inverted Row', muscleGroup: 'BACK', movementPattern: 'PULL', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Dumbbell Row', muscleGroup: 'BACK', movementPattern: 'PULL', equipment: 'DUMBBELL', level: 'BEGINNER', imageKey: 'dumbbell_row' },
  { name: 'Lat Pulldown', muscleGroup: 'BACK', movementPattern: 'PULL', equipment: 'MACHINE_CABLE', level: 'BEGINNER', imageKey: 'latpulldown' },

  // Squat — benen & billen
  { name: 'Bodyweight Squat', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'squats' },
  { name: 'Goblet Squat', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'DUMBBELL', level: 'BEGINNER' },
  { name: 'Leg Press', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'MACHINE_CABLE', level: 'BEGINNER', imageKey: 'beenpers' },

  // Hinge — benen & billen
  { name: 'Glute Bridge', muscleGroup: 'LEGS_GLUTES', movementPattern: 'HINGE', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'glute_bridge' },
  { name: 'Romanian Deadlift', muscleGroup: 'LEGS_GLUTES', movementPattern: 'HINGE', equipment: 'DUMBBELL', level: 'INTERMEDIATE' },

  // Lunge — benen & billen
  { name: 'Reverse Lunge', muscleGroup: 'LEGS_GLUTES', movementPattern: 'LUNGE', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Walking Lunge', muscleGroup: 'LEGS_GLUTES', movementPattern: 'LUNGE', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE' },

  // Core
  { name: 'Plank', muscleGroup: 'CORE', movementPattern: 'CORE_STABILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'plank' },
  { name: 'Dead Bug', muscleGroup: 'CORE', movementPattern: 'CORE_STABILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER' },
  { name: 'Side Plank', muscleGroup: 'CORE', movementPattern: 'CORE_STABILITY', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE' },
  { name: 'Superman', muscleGroup: 'BACK', movementPattern: 'CORE_STABILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'superman' },
  { name: 'Bicycle Crunches', muscleGroup: 'CORE', movementPattern: 'ROTATION', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'bicycle_crunches' },

  // Squat (isometrisch) — benen & billen
  { name: 'Wall Sit', muscleGroup: 'LEGS_GLUTES', movementPattern: 'SQUAT', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'wall_sit' },

  // Cardio
  { name: 'Jumping Jacks', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'jumping_jacks' },
  { name: 'High Knees', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'high_knees' },
  { name: 'Mountain Climbers', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'mountain_climbers' },
  { name: 'Burpees', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE', imageKey: 'burpees' },
  // Trap op en af: thuis of buiten, overal waar een trap is.
  { name: 'Stair Climbs', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'trap_op_af' },
  // Alleen in de fitness (loopband).
  { name: 'Treadmill Intervals', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'TREADMILL', level: 'BEGINNER', imageKey: 'loopband_interval' },
  // Alleen buiten.
  { name: 'Running Intervals', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'BEGINNER', location: 'OUTDOOR', imageKey: 'hardlopen_interval' },
  { name: 'Sprints', muscleGroup: 'CARDIO', movementPattern: 'CARDIO', equipment: 'BODYWEIGHT', level: 'INTERMEDIATE', location: 'OUTDOOR', imageKey: 'sprints' },

  // Mobiliteit & herstel (warming-up, cooldown, rustdag — v0.5 §9)
  { name: 'Cat-Cow', muscleGroup: 'MOBILITY', movementPattern: 'MOBILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'cat_cow' },
  { name: 'Downward Dog', muscleGroup: 'MOBILITY', movementPattern: 'MOBILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'downward_dog' },
  { name: 'Hip Circles', muscleGroup: 'MOBILITY', movementPattern: 'MOBILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'heupcirkels' },
  { name: 'Standing Forward Fold', muscleGroup: 'MOBILITY', movementPattern: 'MOBILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'voorwaartse_stretch' },
  { name: "World's Greatest Stretch", muscleGroup: 'MOBILITY', movementPattern: 'MOBILITY', equipment: 'BODYWEIGHT', level: 'BEGINNER', imageKey: 'worlds_greatest_stretch' },
];
