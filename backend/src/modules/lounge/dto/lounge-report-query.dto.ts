import { IsEnum, IsOptional } from 'class-validator';
import { LoungeReportContentType, LoungeReportStatus } from '../entities/lounge-report.entity';

export class LoungeReportQueryDto {
  @IsOptional()
  @IsEnum(LoungeReportStatus)
  status?: LoungeReportStatus;

  @IsOptional()
  @IsEnum(LoungeReportContentType)
  type?: LoungeReportContentType;
}
