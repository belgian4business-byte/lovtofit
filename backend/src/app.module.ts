import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { BodyMeasurementsModule } from './body-measurements/body-measurements.module.js';
import { CalorieGoalModule } from './calorie-goal/calorie-goal.module.js';
import { FeatureAccessModule } from './feature-access/feature-access.module.js';
import { HealthController } from './health/health.controller.js';
import { MotivationEngineModule } from './motivation-engine/motivation-engine.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RecoveryEngineModule } from './recovery-engine/recovery-engine.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { WaterIntakeModule } from './water-intake/water-intake.module.js';
import { WorkoutsModule } from './workouts/workouts.module.js';

@Module({
  imports: [
    AuthModule,
    OnboardingModule,
    WorkoutsModule,
    RecoveryEngineModule,
    MotivationEngineModule,
    BodyMeasurementsModule,
    WaterIntakeModule,
    CalorieGoalModule,
    FeatureAccessModule,
    SubscriptionsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
