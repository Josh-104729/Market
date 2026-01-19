import { IsString, IsOptional, IsArray, IsEnum, MaxLength } from 'class-validator';
import { PostStatus } from '../../entities/post.entity';

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus;
}

