import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateChatDto {
  @ApiPropertyOptional({
    description: 'Title of the chat session',
    example: 'Shopping for Electronics',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Initial context or topic for the chat',
    example: 'Looking for a new laptop for programming',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  context?: string;
}
