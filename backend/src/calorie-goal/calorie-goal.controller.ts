import { Controller, Get, UseGuards } from '@nestjs/common';
import { AiCoachService } from '../ai-coach/ai-coach.service.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CalorieGoalService } from './calorie-goal.service.js';

@Controller('calorie-goal')
@UseGuards(JwtAuthGuard)
export class CalorieGoalController {
  constructor(
    private readonly calorieGoal: CalorieGoalService,
    private readonly aiCoach: AiCoachService,
  ) {}

  @Get()
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    const report = await this.calorieGoal.getStatus(user.id);
    return { ...report, coachMessage: this.aiCoach.explainCalorieGoal(report) };
  }
}
