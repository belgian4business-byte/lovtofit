import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Difficulty, EnergyLevel } from '../../generated/prisma/enums.js';

export class LoggedSetDto {
  @IsUUID()
  exerciseId!: string;

  @IsInt()
  @Min(1)
  setNumber!: number;

  @IsInt()
  @Min(0)
  reps!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;
}

export class ExerciseFeedbackDto {
  @IsUUID()
  exerciseId!: string;

  @IsEnum(Difficulty)
  difficulty!: Difficulty;

  @IsBoolean()
  discomfort!: boolean;
}

export class SaveWorkoutSessionDto {
  @IsUUID()
  templateId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LoggedSetDto)
  sets!: LoggedSetDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExerciseFeedbackDto)
  feedback!: ExerciseFeedbackDto[];

  /** Fase 8: de energie-keuze waarmee deze training is samengesteld (optioneel). */
  @IsOptional()
  @IsEnum(EnergyLevel)
  energyLevel?: EnergyLevel;
}
