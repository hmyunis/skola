import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationQueryDto } from '../../../core/dto/pagination-query.dto';

export class LoungeFeedQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @IsIn(['newest', 'trending', 'discussed'])
  sort?: string;
}
