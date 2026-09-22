import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Equipment,
  ExerciseEquipment,
  ExperienceLevel,
  MovementPattern,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Welke Exercise-apparatuur een gebruiker kan gebruiken per stuk apparatuur
 * dat hij bij onboarding opgaf. Bodyweight is altijd beschikbaar.
 */
const EQUIPMENT_MAP: Record<Equipment, ExerciseEquipment[]> = {
  NONE: [],
  DUMBBELLS: ['DUMBBELL'],
  RESISTANCE_BANDS: [],
  KETTLEBELL: [],
  FULL_GYM: ['DUMBBELL', 'BARBELL', 'MACHINE_CABLE'],
};

// Vast MVP-doel voor elke oefening. Bewust simpel — geen per-oefening of
// per-niveau afstemming (bv. holds in seconden i.p.v. reps voor Plank).
// Wordt slimmer gemaakt zodra de Progress Engine er is.
const DEFAULT_TARGET_SETS = 3;
const DEFAULT_TARGET_REPS = 12;

export interface TodaysWorkoutSlot {
  order: number;
  movementPattern: MovementPattern;
  targetSets: number;
  targetReps: number;
  exercise: {
    id: string;
    name: string;
    muscleGroup: string;
    equipment: string;
    level: string;
  };
}

export interface TodaysWorkout {
  templateId: string;
  templateName: string;
  slots: TodaysWorkoutSlot[];
}

/**
 * Decision Engine v1 — bewust simpel (CLAUDE.md Fase 2, stap 3).
 * Kiest vandaag een template op basis van niveau, en vult elke slot in met
 * een oefening die past bij de apparatuur van de gebruiker. Nog geen
 * scoresysteem, geen herstel-/progressiecontroles, geen variatielogica —
 * dat komt pas als de engine "slimmer" wordt gemaakt.
 */
@Injectable()
export class DecisionEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodaysWorkout(userId: string): Promise<TodaysWorkout> {
    const preferences = await this.prisma.trainingPreferences.findUnique({ where: { userId } });
    if (!preferences) {
      throw new NotFoundException('Onboarding nog niet afgerond');
    }

    const templates = await this.prisma.workoutTemplate.findMany({
      include: { slots: { orderBy: { order: 'asc' } } },
    });
    if (templates.length === 0) {
      throw new NotFoundException('Geen trainingstemplates beschikbaar');
    }
    const template = templates.find((t) => t.level === preferences.level) ?? templates[0];

    const allowedEquipment = this.allowedExerciseEquipment(preferences.equipment);

    const slots: TodaysWorkoutSlot[] = [];
    for (const slot of template.slots) {
      const exercise = await this.pickExercise(
        slot.movementPattern,
        allowedEquipment,
        preferences.level,
      );
      if (!exercise) {
        throw new NotFoundException(
          `Geen geschikte oefening gevonden voor ${slot.movementPattern}`,
        );
      }
      slots.push({
        order: slot.order,
        movementPattern: slot.movementPattern,
        targetSets: DEFAULT_TARGET_SETS,
        targetReps: DEFAULT_TARGET_REPS,
        exercise: {
          id: exercise.id,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          equipment: exercise.equipment,
          level: exercise.level,
        },
      });
    }

    return { templateId: template.id, templateName: template.name, slots };
  }

  private allowedExerciseEquipment(userEquipment: Equipment[]): ExerciseEquipment[] {
    const allowed = new Set<ExerciseEquipment>(['BODYWEIGHT']);
    for (const equipment of userEquipment) {
      for (const mapped of EQUIPMENT_MAP[equipment]) {
        allowed.add(mapped);
      }
    }
    return [...allowed];
  }

  private async pickExercise(
    movementPattern: MovementPattern,
    allowedEquipment: ExerciseEquipment[],
    level: ExperienceLevel,
  ) {
    const candidates = await this.prisma.exercise.findMany({
      where: { movementPattern, equipment: { in: allowedEquipment } },
      orderBy: { name: 'asc' },
    });
    if (candidates.length === 0) return null;
    return candidates.find((candidate) => candidate.level === level) ?? candidates[0];
  }
}
