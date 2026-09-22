import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecoveryEngineController } from './recovery-engine.controller.js';
import { RecoveryEngineService } from './recovery-engine.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RecoveryEngineController],
  providers: [RecoveryEngineService, PrismaService, JwtAuthGuard],
  exports: [RecoveryEngineService],
})
export class RecoveryEngineModule {}
