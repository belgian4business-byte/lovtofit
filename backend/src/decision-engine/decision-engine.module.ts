import { Module } from '@nestjs/common';
import { AiCoachModule } from '../ai-coach/ai-coach.module.js';
import { MotivationEngineModule } from '../motivation-engine/motivation-engine.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecoveryEngineModule } from '../recovery-engine/recovery-engine.module.js';
import { RuleGuardModule } from '../rule-guard/rule-guard.module.js';
import { DecisionEngineService } from './decision-engine.service.js';

@Module({
  imports: [RecoveryEngineModule, RuleGuardModule, MotivationEngineModule, AiCoachModule],
  providers: [DecisionEngineService, PrismaService],
  exports: [DecisionEngineService],
})
export class DecisionEngineModule {}
