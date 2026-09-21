import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { PrismaService } from './prisma/prisma.service.js';

@Module({
  imports: [AuthModule, OnboardingModule],
  controllers: [AppController, HealthController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
