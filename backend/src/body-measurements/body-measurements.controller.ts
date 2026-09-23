import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AiCoachService } from '../ai-coach/ai-coach.service.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BodyMeasurementsService } from './body-measurements.service.js';
import { LogWeightDto } from './dto/log-weight.dto.js';

@Controller('body-measurements')
@UseGuards(JwtAuthGuard)
export class BodyMeasurementsController {
  constructor(
    private readonly bodyMeasurements: BodyMeasurementsService,
    private readonly aiCoach: AiCoachService,
  ) {}

  @Post()
  logWeight(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogWeightDto) {
    return this.bodyMeasurements.logWeight(user.id, dto.weightKg);
  }

  @Get()
  async getTrend(@CurrentUser() user: AuthenticatedUser) {
    const trend = await this.bodyMeasurements.getTrend(user.id);
    return { ...trend, coachMessage: this.aiCoach.explainWeightTrend(trend.status, trend.direction) };
  }
}
