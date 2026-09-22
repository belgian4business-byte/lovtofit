import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

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

export class SaveWorkoutSessionDto {
  @IsUUID()
  templateId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LoggedSetDto)
  sets!: LoggedSetDto[];
}
