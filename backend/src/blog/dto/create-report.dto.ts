import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  details?: string;
}

