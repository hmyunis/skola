import { IsIn, IsOptional } from 'class-validator';

export class ModerationQueryDto {
  @IsOptional()
  @IsIn(['pending', 'resolved', 'dismissed'])
  status?: 'pending' | 'resolved' | 'dismissed';

  @IsOptional()
  @IsIn(['resource', 'post', 'reply', 'quiz'])
  type?: 'resource' | 'post' | 'reply' | 'quiz';
}
