import { IsString, IsNotEmpty, IsNumber, IsArray, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  adText: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  balance: number;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  tags: string[];
}

