import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DecisionEngineService } from '../decision-engine/decision-engine.service.js';
import { SaveWorkoutSessionDto } from './dto/save-workout-session.dto.js';
import { WorkoutSessionsService } from './workout-sessions.service.js';

@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(
    private readonly decisionEngine: DecisionEngineService,
    private readonly sessions: WorkoutSessionsService,
  ) {}

  @Get('today')
  getToday(@CurrentUser() user: AuthenticatedUser) {
    return this.decisionEngine.getTodaysWorkout(user.id);
  }

  @Post('sessions')
  saveSession(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveWorkoutSessionDto) {
    return this.sessions.save(user.id, dto);
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.listForUser(user.id);
  }
}
