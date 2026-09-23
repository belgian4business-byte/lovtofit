import { Module } from '@nestjs/common';
import { AiCoachModule } from '../ai-coach/ai-coach.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MotivationEngineController } from './motivation-engine.controller.js';
import { MotivationEngineService } from './motivation-engine.service.js';

@Module({
  imports: [AuthModule, AiCoachModule],
  controllers: [MotivationEngineController],
  providers: [MotivationEngineService, PrismaService, JwtAuthGuard],
  exports: [MotivationEngineService],
})
export class MotivationEngineModule {}
