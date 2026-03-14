import { IsArray, ArrayMinSize, IsInt, Min } from 'class-validator';

export class AttemptQuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  answers: number[];
}
