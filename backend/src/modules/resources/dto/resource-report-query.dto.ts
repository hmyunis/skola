import { IsEnum, IsOptional } from 'class-validator';
import { ResourceReportStatus } from '../entities/resource-report.entity';

export class ResourceReportQueryDto {
  @IsOptional()
  @IsEnum(ResourceReportStatus)
  status?: ResourceReportStatus;
}
