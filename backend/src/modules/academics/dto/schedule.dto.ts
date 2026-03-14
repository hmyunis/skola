import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMilitaryTime,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateScheduleItemDto {
  @IsUUID()
  courseId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  dayOfWeek: number;

  @IsMilitaryTime()
  startTime: string;

  @IsMilitaryTime()
  endTime: string;

  @IsIn(['lecture', 'lab', 'exam'])
  type: 'lecture' | 'lab' | 'exam';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}

export class UpdateScheduleItemDto {
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  dayOfWeek?: number;

  @IsOptional()
  @IsMilitaryTime()
  startTime?: string;

  @IsOptional()
  @IsMilitaryTime()
  endTime?: string;

  @IsOptional()
  @IsIn(['lecture', 'lab', 'exam'])
  type?: 'lecture' | 'lab' | 'exam';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}
