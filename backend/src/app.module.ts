import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { MotivationEngineModule } from './motivation-engine/motivation-engine.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RecoveryEngineModule } from './recovery-engine/recovery-engine.module.js';
import { WorkoutsModule } from './workouts/workouts.module.js';

@Module({
  imports: [
    AuthModule,
    OnboardingModule,
    WorkoutsModule,
    RecoveryEngineModule,
    MotivationEngineModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
