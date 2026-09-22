import { Module } from '@nestjs/common';
import { AiCoachModule } from '../ai-coach/ai-coach.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DecisionEngineModule } from '../decision-engine/decision-engine.module.js';
import { MotivationEngineModule } from '../motivation-engine/motivation-engine.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressionEngineModule } from '../progression-engine/progression-engine.module.js';
import { RuleGuardModule } from '../rule-guard/rule-guard.module.js';
import { WorkoutSessionsService } from './workout-sessions.service.js';
import { WorkoutsController } from './workouts.controller.js';

@Module({
  imports: [
    AuthModule,
    DecisionEngineModule,
    ProgressionEngineModule,
    RuleGuardModule,
    MotivationEngineModule,
    AiCoachModule,
  ],
  controllers: [WorkoutsController],
  providers: [JwtAuthGuard, WorkoutSessionsService, PrismaService],
})
export class WorkoutsModule {}
