import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PostReportStatus } from '../../entities/post-report.entity';

export class UpdateReportStatusDto {
  @IsEnum(PostReportStatus)
  status: PostReportStatus;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  resolutionNote?: string;
}

