import { IsOptional, IsUUID } from 'class-validator';

export class DeleteMyAccountDto {
  @IsOptional()
  @IsUUID()
  successorMemberId?: string;
}
