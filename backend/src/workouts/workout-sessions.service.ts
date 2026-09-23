import { Injectable } from '@nestjs/common';
import { AiCoachService } from '../ai-coach/ai-coach.service.js';
import { repsForProgressionDecision } from '../decision-engine/decision-engine.service.js';
import { MotivationEngineService } from '../motivation-engine/motivation-engine.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressionEngineService } from '../progression-engine/progression-engine.service.js';
import { RuleGuardService } from '../rule-guard/rule-guard.service.js';
import { SaveWorkoutSessionDto } from './dto/save-workout-session.dto.js';

@Injectable()
export class WorkoutSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressionEngine: ProgressionEngineService,
    private readonly ruleGuard: RuleGuardService,
    private readonly motivationEngine: MotivationEngineService,
    private readonly aiCoach: AiCoachService,
  ) {}

  async save(userId: string, dto: SaveWorkoutSessionDto) {
    this.ruleGuard.assertNoDuplicateSets(dto.sets);

    const session = await this.prisma.workoutSession.create({
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
        feedback: {
          create: dto.feedback.map((entry) => ({
            exerciseId: entry.exerciseId,
            difficulty: entry.difficulty,
            discomfort: entry.discomfort,
          })),
        },
      },
      include: { loggedSets: true, feedback: true },
    });

    const progressionDecisions = await this.progressionEngine.evaluateSession(
      userId,
      session.id,
      dto.sets,
      dto.feedback,
    );

    const motivation = await this.motivationEngine.getStatus(userId);
    const uniqueExerciseIds = new Set(dto.sets.map((s) => s.exerciseId));
    const coachMessage = this.aiCoach.summarizeCompletedSession({
      exerciseCount: uniqueExerciseIds.size,
      setCount: dto.sets.length,
      hadDiscomfort: dto.feedback.some((f) => f.discomfort),
      milestone: motivation.milestone,
      hasIncrease: progressionDecisions.some((d) => d.decision === 'INCREASE'),
      motivationSignal: motivation.signal,
    });

    // Bewaard bij de sessie (niet alleen teruggegeven), zodat de Coach-tab
    // later ook oudere berichten kan tonen, niet enkel die van vandaag.
    await this.prisma.workoutSession.update({ where: { id: session.id }, data: { coachMessage } });

    // CLAUDE.md Fase 4, stap 4: per oefening tonen wat de Progression
    // Engine besliste ("volgende keer 14 reps" / "andere oefening
    // gekozen"). Oefeningnamen erbij zoeken, net als bij listForUser, zodat
    // de app geen losse ids hoeft te vertalen.
    const exercises = await this.prisma.exercise.findMany({
      where: { id: { in: progressionDecisions.map((d) => d.exerciseId) } },
      select: { id: true, name: true },
    });
    const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));
    const progressionOutcomes = progressionDecisions.map((d) => ({
      exerciseId: d.exerciseId,
      exerciseName: exerciseNameById.get(d.exerciseId) ?? '',
      decision: d.decision,
      message: this.aiCoach.explainProgressionOutcome(
        d.decision,
        repsForProgressionDecision(d.decision),
      ),
    }));

    return { ...session, progressionOutcomes, coachMessage };
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
      coachMessage: session.coachMessage,
      sets: session.loggedSets.map((set) => ({
        exerciseName: set.exercise.name,
        setNumber: set.setNumber,
        reps: set.reps,
        weightKg: set.weightKg,
      })),
    }));
  }
}
