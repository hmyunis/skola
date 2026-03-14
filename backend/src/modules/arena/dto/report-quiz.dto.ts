import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportQuizDto {
  @IsString()
  @MaxLength(100)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
