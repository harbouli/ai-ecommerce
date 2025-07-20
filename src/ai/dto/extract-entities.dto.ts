import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class ExtractEntitiesDto {
  @ApiProperty({
    type: String,
    example: 'I need brake pads for my 2018 Honda Civic',
    description: 'Text to extract entities from',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000)
  text: string;
}
