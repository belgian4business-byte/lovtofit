import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SubmitOnboardingDto } from './dto/submit-onboarding.dto.js';
import { OnboardingService } from './onboarding.service.js';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // Profiel-scherm (Fase 10): de huidige onboarding-gegevens + e-mail.
  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.get(user.id);
  }

  @Post()
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitOnboardingDto) {
    return this.onboardingService.submit(user.id, dto);
  }
}
