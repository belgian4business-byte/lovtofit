import { IsNumber, Max, Min } from 'class-validator';

// Ondergrens/bovengrens zijn een basis-invoercontrole (fat-finger-fouten
// afvangen), geen Rule Guard-veiligheidsbeslissing — die komt pas bij de
// echte Nutrition Engine-stappen (calorieën/macro's, blueprint v2.17.17).
export class LogWeightDto {
  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg!: number;
}
