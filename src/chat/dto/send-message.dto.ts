import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendMessageDto {
  @ApiProperty({
    description: 'The content of the message',
    example: 'Hello, how can I help you today?',
    maxLength: 4000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(4000)
  @Transform(({ value }) => value?.trim())
  content: string;
}
