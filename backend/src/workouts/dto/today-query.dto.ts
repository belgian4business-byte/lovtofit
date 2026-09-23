import { IsEnum, IsOptional } from 'class-validator';
import { EnergyLevel } from '../../generated/prisma/enums.js';

// Fase 8: optionele energie-check vóór de training. Weglaten = overgeslagen
// (de check is nooit verplicht).
export class TodayQueryDto {
  @IsOptional()
  @IsEnum(EnergyLevel)
  energy?: EnergyLevel;
}
