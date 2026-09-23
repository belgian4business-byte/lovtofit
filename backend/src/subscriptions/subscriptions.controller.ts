import { Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post('trial')
  startTrial(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.startTrial(user.id);
  }
}
