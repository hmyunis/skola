import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExamPeriodDto {
  @IsDateString()
  start: string;

  @IsDateString()
  end: string;
}

export class BreakDto {
  @IsString()
  name: string;

  @IsDateString()
  start: string;

  @IsDateString()
  end: string;
}

export class CreateSemesterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @IsOptional()
  year?: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsEnum(['active', 'upcoming', 'archived'])
  @IsOptional()
  status?: 'active' | 'upcoming' | 'archived';

  @IsOptional()
  @ValidateNested()
  @Type(() => ExamPeriodDto)
  examPeriod?: ExamPeriodDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BreakDto)
  breaks?: BreakDto[];
}

export class UpdateSemesterDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  year?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsEnum(['active', 'upcoming', 'archived'])
  @IsOptional()
  status?: 'active' | 'upcoming' | 'archived';

  @IsOptional()
  @ValidateNested()
  @Type(() => ExamPeriodDto)
  examPeriod?: ExamPeriodDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BreakDto)
  breaks?: BreakDto[];
}
