import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RecipesService } from './recipes.service.js';

@Controller('recipes')
@UseGuards(JwtAuthGuard)
export class RecipesController {
  constructor(private readonly recipes: RecipesService) {}

  @Get()
  getRecipes(@CurrentUser() user: AuthenticatedUser) {
    return this.recipes.getForUser(user.id);
  }
}
