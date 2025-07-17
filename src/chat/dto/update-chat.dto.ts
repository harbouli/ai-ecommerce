import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateChatDto {
  @ApiProperty({
    description: 'The updated title of the chat session',
    example: 'Updated Chat Session',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  title?: string;
}
