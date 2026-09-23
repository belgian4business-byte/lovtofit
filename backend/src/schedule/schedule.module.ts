import { Module } from '@nestjs/common';
import { AiCoachModule } from '../ai-coach/ai-coach.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { FeatureAccessModule } from '../feature-access/feature-access.module.js';
import { MotivationEngineModule } from '../motivation-engine/motivation-engine.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RuleGuardModule } from '../rule-guard/rule-guard.module.js';
import { ScheduleController } from './schedule.controller.js';
import { ScheduleService } from './schedule.service.js';

@Module({
  imports: [AuthModule, FeatureAccessModule, RuleGuardModule, MotivationEngineModule, AiCoachModule],
  controllers: [ScheduleController],
  providers: [ScheduleService, PrismaService, JwtAuthGuard],
  exports: [ScheduleService],
})
export class ScheduleModule {}
