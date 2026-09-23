import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FeatureAccessController } from './feature-access.controller.js';
import { FeatureAccessService } from './feature-access.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FeatureAccessController],
  providers: [FeatureAccessService, PrismaService, JwtAuthGuard],
  exports: [FeatureAccessService],
})
export class FeatureAccessModule {}
