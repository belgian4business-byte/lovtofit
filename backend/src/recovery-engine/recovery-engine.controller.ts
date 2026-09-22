import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RecoveryEngineService } from './recovery-engine.service.js';

@Controller('recovery')
@UseGuards(JwtAuthGuard)
export class RecoveryEngineController {
  constructor(private readonly recoveryEngine: RecoveryEngineService) {}

  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.recoveryEngine.getStatus(user.id);
  }
}
