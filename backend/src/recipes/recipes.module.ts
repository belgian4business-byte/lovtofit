import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { FeatureAccessModule } from '../feature-access/feature-access.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecipesController } from './recipes.controller.js';
import { RecipesService } from './recipes.service.js';

@Module({
  imports: [AuthModule, FeatureAccessModule],
  controllers: [RecipesController],
  providers: [RecipesService, PrismaService, JwtAuthGuard],
})
export class RecipesModule {}
