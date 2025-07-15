import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsObject, IsUrl } from 'class-validator';

export enum ImageAnalysisType {
  OBJECT_DETECTION = 'object_detection',
  TEXT_EXTRACTION = 'text_extraction',
  SCENE_ANALYSIS = 'scene_analysis',
  PRODUCT_ANALYSIS = 'product_analysis',
  GENERAL_DESCRIPTION = 'general_description',
}

export class AnalyzeImageDto {
  @ApiPropertyOptional({
    description: 'URL of the image to analyze',
    example: 'https://example.com/images/product.jpg',
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Base64 encoded image data',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...',
  })
  @IsOptional()
  @IsString()
  imageData?: string;

  @ApiProperty({
    description: 'Type of analysis to perform',
    example: ImageAnalysisType.PRODUCT_ANALYSIS,
    enum: ImageAnalysisType,
  })
  @IsEnum(ImageAnalysisType)
  analysisType: ImageAnalysisType;

  @ApiPropertyOptional({
    description: 'AI model to use for analysis',
    example: 'vision-transformer',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Additional parameters for analysis',
    example: { confidence_threshold: 0.8, max_objects: 10 },
  })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Session ID to associate this analysis with',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
