import { Module } from '@nestjs/common';
import { AiCoachModule } from '../ai-coach/ai-coach.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WaterIntakeController } from './water-intake.controller.js';
import { WaterIntakeService } from './water-intake.service.js';

@Module({
  imports: [AuthModule, AiCoachModule],
  controllers: [WaterIntakeController],
  providers: [WaterIntakeService, PrismaService, JwtAuthGuard],
})
export class WaterIntakeModule {}
