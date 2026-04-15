import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AssistantChatHistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class AssistantChatRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantChatHistoryMessageDto)
  history?: AssistantChatHistoryMessageDto[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientTimeZone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  clientLocale?: string;

  @IsOptional()
  @IsISO8601()
  clientNowIso?: string;
}
