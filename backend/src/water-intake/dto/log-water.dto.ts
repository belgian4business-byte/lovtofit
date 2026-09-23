import { IsInt, Max, Min } from 'class-validator';

// Bovengrens is een basis-invoercontrole (fat-finger-fouten afvangen, bv.
// per ongeluk 25000 i.p.v. 250 ml), geen Rule Guard-veiligheidsbeslissing.
export class LogWaterDto {
  @IsInt()
  @Min(1)
  @Max(3000)
  amountMl!: number;
}
