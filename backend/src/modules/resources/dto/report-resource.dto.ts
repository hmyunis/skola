import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportResourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
