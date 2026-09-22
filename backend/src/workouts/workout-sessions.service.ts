import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SaveWorkoutSessionDto } from './dto/save-workout-session.dto.js';

@Injectable()
export class WorkoutSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, dto: SaveWorkoutSessionDto) {
    return this.prisma.workoutSession.create({
      data: {
        userId,
        templateId: dto.templateId,
        loggedSets: {
          create: dto.sets.map((set) => ({
            exerciseId: set.exerciseId,
            setNumber: set.setNumber,
            reps: set.reps,
            weightKg: set.weightKg,
          })),
        },
      },
      include: { loggedSets: true },
    });
  }

  async listForUser(userId: string) {
    const sessions = await this.prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      include: {
        template: { select: { name: true } },
        loggedSets: {
          orderBy: { setNumber: 'asc' },
          include: { exercise: { select: { name: true } } },
        },
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      templateName: session.template.name,
      completedAt: session.completedAt,
      sets: session.loggedSets.map((set) => ({
        exerciseName: set.exercise.name,
        setNumber: set.setNumber,
        reps: set.reps,
        weightKg: set.weightKg,
      })),
    }));
  }
}
