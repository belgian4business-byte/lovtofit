import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { FeatureAccessService } from './feature-access.service.js';

@Controller('features')
@UseGuards(JwtAuthGuard)
export class FeatureAccessController {
  constructor(private readonly featureAccess: FeatureAccessService) {}

  @Get()
  getFeatures(@CurrentUser() user: AuthenticatedUser) {
    return this.featureAccess.getFeatureAccess(user.id);
  }
}
