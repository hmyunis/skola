import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class ReviewQuizReportDto {
  @IsIn(['resolved', 'dismissed'])
  status: 'resolved' | 'dismissed';

  @IsOptional()
  @IsBoolean()
  removeQuiz?: boolean;
}
