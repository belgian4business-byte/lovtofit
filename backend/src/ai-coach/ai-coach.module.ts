import { Module } from '@nestjs/common';
import { AiCoachService } from './ai-coach.service.js';

@Module({
  providers: [AiCoachService],
  exports: [AiCoachService],
})
export class AiCoachModule {}
