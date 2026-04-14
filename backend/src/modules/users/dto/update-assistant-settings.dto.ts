import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAssistantSettingsDto {
  @IsOptional()
  @IsBoolean()
  usePersonalApiKey?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;
}
