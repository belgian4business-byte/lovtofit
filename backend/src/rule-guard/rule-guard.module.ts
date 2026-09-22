import { Module } from '@nestjs/common';
import { RuleGuardService } from './rule-guard.service.js';

@Module({
  providers: [RuleGuardService],
  exports: [RuleGuardService],
})
export class RuleGuardModule {}
