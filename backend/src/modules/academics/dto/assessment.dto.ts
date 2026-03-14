import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AssessmentSource,
  AssessmentStatus,
  AssessmentType,
} from '../entities/assessment.entity';
import { AssessmentConfidenceVote } from '../entities/assessment-rating.entity';

export class CreateAssessmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title: string;

  @IsEnum(AssessmentType)
  type: AssessmentType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  courseCode: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;

  @IsOptional()
  @IsEnum(AssessmentSource)
  source?: AssessmentSource;

  @IsUUID()
  semesterId: string;
}

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  courseCode?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;

  @IsOptional()
  @IsEnum(AssessmentSource)
  source?: AssessmentSource;

  @IsOptional()
  @IsUUID()
  semesterId?: string;
}

export class AssessmentQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @IsOptional()
  @IsString()
  courseCode?: string;

  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;

  @IsOptional()
  @IsEnum(AssessmentSource)
  source?: AssessmentSource;
}

export class RateAssessmentDto {
  @IsEnum(AssessmentConfidenceVote)
  vote: AssessmentConfidenceVote;
}
