import { IsOptional, IsString, Length } from 'class-validator';

export class CreateHelpRequestDto {
  @IsString()
  @Length(3, 200)
  title: string;

  @IsString()
  @Length(5, 5000)
  content: string;

  // Image is uploaded via multipart form-data (field name: "image")
  @IsOptional()
  image?: any;
}


