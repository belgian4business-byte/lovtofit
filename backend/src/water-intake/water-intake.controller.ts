import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AiCoachService } from '../ai-coach/ai-coach.service.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { LogWaterDto } from './dto/log-water.dto.js';
import { WaterIntakeService } from './water-intake.service.js';

@Controller('water-intake')
@UseGuards(JwtAuthGuard)
export class WaterIntakeController {
  constructor(
    private readonly waterIntake: WaterIntakeService,
    private readonly aiCoach: AiCoachService,
  ) {}

  @Post()
  logIntake(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogWaterDto) {
    return this.waterIntake.logIntake(user.id, dto.amountMl);
  }

  @Get('today')
  async getTodayStatus(@CurrentUser() user: AuthenticatedUser) {
    const status = await this.waterIntake.getTodayStatus(user.id);
    return { ...status, coachMessage: this.aiCoach.explainWaterStatus(status) };
  }
}
