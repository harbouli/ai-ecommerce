import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateChatDto {
  @ApiPropertyOptional({
    description: 'Updated title of the chat session',
    example: 'Shopping for Electronics - Updated',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated context for the chat',
    example: 'Looking for a gaming laptop under $2000',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  context?: string;
}

// dto/find-all-chats.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, Max } from 'class-validator';

export class FindAllChatsDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
