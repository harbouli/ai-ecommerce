import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class ClassifyIntentDto {
  @ApiProperty({
    type: String,
    example: 'I need brake pads for my Honda',
    description: 'Text to classify intent for',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000)
  text: string;
}
