import { IsString, MaxLength, MinLength } from 'class-validator';

export class RemoveWebPushSubscriptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  endpoint: string;
}
