import { Type } from 'class-transformer';
import { IsIn } from 'class-validator';
import { QUICK_SESSION_MINUTE_OPTIONS } from '../../decision-engine/decision-engine.service.js';

// Alleen de vaste keuzes 10/15 min (zie QUICK_SESSION_MINUTE_OPTIONS).
export class QuickSessionQueryDto {
  @Type(() => Number)
  @IsIn(QUICK_SESSION_MINUTE_OPTIONS)
  minutes!: number;
}
