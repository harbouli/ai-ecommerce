import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  Length,
} from 'class-validator';

export class GenerateShoppingResponseDto {
  @ApiProperty({
    type: String,
    example: 'What brake pads do you recommend for my Honda Civic?',
    description: 'Customer query',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000)
  query: string;

  @ApiProperty({
    type: [String],
    example: [
      'Bosch QuietCast Brake Pads - $45.99 - Premium ceramic brake pads for Honda Civic 2018-2022',
      'ACDelco Professional Brake Pads - $32.99 - OEM equivalent brake pads',
    ],
    description: 'Array of product context information',
  })
  @IsArray()
  @IsString({ each: true })
  productContext: string[];

  @ApiPropertyOptional({
    type: Object,
    example: {
      preferredBrand: 'OEM',
      budgetRange: '$30-50',
      vehicleYear: 2018,
      vehicleModel: 'Honda Civic',
    },
    description: 'User preferences and history',
  })
  @IsOptional()
  userPreferences?: any;
}
