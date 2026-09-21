import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SubmitOnboardingDto } from './dto/submit-onboarding.dto.js';
import { OnboardingService } from './onboarding.service.js';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post()
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitOnboardingDto) {
    return this.onboardingService.submit(user.id, dto);
  }
}
