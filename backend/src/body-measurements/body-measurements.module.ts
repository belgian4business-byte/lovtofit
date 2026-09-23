import { Module } from '@nestjs/common';
import { AiCoachModule } from '../ai-coach/ai-coach.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BodyMeasurementsController } from './body-measurements.controller.js';
import { BodyMeasurementsService } from './body-measurements.service.js';

@Module({
  imports: [AuthModule, AiCoachModule],
  controllers: [BodyMeasurementsController],
  providers: [BodyMeasurementsService, PrismaService, JwtAuthGuard],
})
export class BodyMeasurementsModule {}
