import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DecisionEngineModule } from '../decision-engine/decision-engine.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkoutSessionsService } from './workout-sessions.service.js';
import { WorkoutsController } from './workouts.controller.js';

@Module({
  imports: [AuthModule, DecisionEngineModule],
  controllers: [WorkoutsController],
  providers: [JwtAuthGuard, WorkoutSessionsService, PrismaService],
})
export class WorkoutsModule {}
