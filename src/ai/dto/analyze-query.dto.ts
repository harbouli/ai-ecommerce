import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class AnalyzeQueryDto {
  @ApiProperty({
    type: String,
    example: 'I need brake pads for my Honda Civic 2018',
    description: 'User query text to analyze',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000)
  query: string;

  @ApiPropertyOptional({
    type: String,
    example: 'user_123',
    description: 'Optional user ID for personalization',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
