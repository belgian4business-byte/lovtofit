import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ScheduleService } from './schedule.service.js';

@Controller('schedule')
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('week')
  getWeek(@CurrentUser() user: AuthenticatedUser) {
    return this.schedule.getWeek(user.id);
  }
}
