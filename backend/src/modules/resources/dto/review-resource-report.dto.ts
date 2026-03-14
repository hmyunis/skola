import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ResourceReportStatus } from '../entities/resource-report.entity';

export class ReviewResourceReportDto {
  @IsIn([ResourceReportStatus.RESOLVED, ResourceReportStatus.DISMISSED])
  status: ResourceReportStatus.RESOLVED | ResourceReportStatus.DISMISSED;

  @IsOptional()
  @IsBoolean()
  removeResource?: boolean;
}
