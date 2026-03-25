import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateImageUploadSettingsDto {
  @IsOptional()
  @IsBoolean()
  usePersonalApiKey?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;
}
