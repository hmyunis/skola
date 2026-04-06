import { IsIn, IsOptional } from 'class-validator';
import { QuizReportStatus } from '../entities/quiz-report.entity';

export class QuizReportQueryDto {
  @IsOptional()
  @IsIn([
    QuizReportStatus.PENDING,
    QuizReportStatus.RESOLVED,
    QuizReportStatus.DISMISSED,
  ])
  status?: QuizReportStatus;
}
