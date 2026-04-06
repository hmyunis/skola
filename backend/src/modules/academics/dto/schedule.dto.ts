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
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsMilitaryTime()
  startTime: string;

  @IsMilitaryTime()
  endTime: string;

  @IsIn(['lecture', 'lab', 'exam', 'other'])
  type: 'lecture' | 'lab' | 'exam' | 'other';

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

  @IsOptional()
  @IsIn(['auto', 'on', 'off'])
  fireMode?: 'auto' | 'on' | 'off';
}

export class UpdateScheduleItemDto {
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsMilitaryTime()
  startTime?: string;

  @IsOptional()
  @IsMilitaryTime()
  endTime?: string;

  @IsOptional()
  @IsIn(['lecture', 'lab', 'exam', 'other'])
  type?: 'lecture' | 'lab' | 'exam' | 'other';

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

  @IsOptional()
  @IsIn(['auto', 'on', 'off'])
  fireMode?: 'auto' | 'on' | 'off';
}
