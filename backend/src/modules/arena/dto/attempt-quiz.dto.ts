import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AttemptQuizDto {
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  answers: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  answeredCount?: number;

  @IsOptional()
  @IsBoolean()
  timedOut?: boolean;
}
