import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressionEngineService } from './progression-engine.service.js';

@Module({
  providers: [ProgressionEngineService, PrismaService],
  exports: [ProgressionEngineService],
})
export class ProgressionEngineModule {}
