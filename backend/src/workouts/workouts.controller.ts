import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { DecisionEngineService } from '../decision-engine/decision-engine.service.js';
import { QuickSessionQueryDto } from './dto/quick-session-query.dto.js';
import { SaveWorkoutSessionDto } from './dto/save-workout-session.dto.js';
import { TodayQueryDto } from './dto/today-query.dto.js';
import { WorkoutSessionsService } from './workout-sessions.service.js';

@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(
    private readonly decisionEngine: DecisionEngineService,
    private readonly sessions: WorkoutSessionsService,
  ) {}

  @Get('today')
  getToday(@CurrentUser() user: AuthenticatedUser, @Query() query: TodayQueryDto) {
    return this.decisionEngine.getTodaysWorkout(user.id, query.energy);
  }

  // Premium (CAN_USE_QUICK_SESSION): de check zit in de Decision Engine zelf.
  @Get('quick-session')
  getQuickSession(@CurrentUser() user: AuthenticatedUser, @Query() query: QuickSessionQueryDto) {
    return this.decisionEngine.getQuickSession(user.id, query.minutes);
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
