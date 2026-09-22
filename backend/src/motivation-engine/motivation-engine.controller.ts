import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { MotivationEngineService } from './motivation-engine.service.js';

@Controller('motivation')
@UseGuards(JwtAuthGuard)
export class MotivationEngineController {
  constructor(private readonly motivationEngine: MotivationEngineService) {}

  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.motivationEngine.getStatus(user.id);
  }
}
