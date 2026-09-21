import { ArrayMinSize, IsArray, IsEnum, IsInt, Max, Min } from 'class-validator';
import {
  Equipment,
  ExperienceLevel,
  GoalType,
  SessionDuration,
  TrainingLocation,
} from '../../generated/prisma/enums.js';

export class SubmitOnboardingDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(GoalType, { each: true })
  goals!: GoalType[];

  @IsEnum(TrainingLocation)
  location!: TrainingLocation;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Equipment, { each: true })
  equipment!: Equipment[];

  @IsEnum(SessionDuration)
  sessionDuration!: SessionDuration;

  @IsInt()
  @Min(2)
  @Max(6)
  weeklyFrequency!: number;

  @IsEnum(ExperienceLevel)
  level!: ExperienceLevel;
}
