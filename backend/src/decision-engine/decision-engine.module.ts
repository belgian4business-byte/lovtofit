import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DecisionEngineService } from './decision-engine.service.js';

@Module({
  providers: [DecisionEngineService, PrismaService],
  exports: [DecisionEngineService],
})
export class DecisionEngineModule {}
