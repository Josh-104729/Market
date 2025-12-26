import { IsArray, IsNotEmpty, IsString, ArrayNotEmpty } from 'class-validator';

export class DeleteMessagesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  messageIds: string[];
}


