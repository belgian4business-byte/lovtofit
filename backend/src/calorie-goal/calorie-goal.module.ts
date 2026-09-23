import { Module } from '@nestjs/common';
import { AiCoachModule } from '../ai-coach/ai-coach.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { FeatureAccessModule } from '../feature-access/feature-access.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CalorieGoalController } from './calorie-goal.controller.js';
import { CalorieGoalService } from './calorie-goal.service.js';

@Module({
  imports: [AuthModule, AiCoachModule, FeatureAccessModule],
  controllers: [CalorieGoalController],
  providers: [CalorieGoalService, PrismaService, JwtAuthGuard],
})
export class CalorieGoalModule {}
