import { ApiProperty } from '@nestjs/swagger';

export class TranslationResult {
  @ApiProperty({
    type: String,
    example: 'translation_123',
    description: 'Unique identifier for the translation result',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'Hello, how are you?',
    description: 'Original text before translation',
  })
  originalText: string;

  @ApiProperty({
    type: String,
    example: 'Hola, ¿cómo estás?',
    description: 'Translated text',
  })
  translatedText: string;

  @ApiProperty({
    type: String,
    example: 'en',
    description: 'Source language code',
  })
  sourceLanguage: string;

  @ApiProperty({
    type: String,
    example: 'es',
    description: 'Target language code',
  })
  targetLanguage: string;

  @ApiProperty({
    type: Number,
    example: 0.96,
    description: 'Translation confidence score (0-1)',
  })
  confidence: number;

  @ApiProperty({
    type: String,
    example: 'mistral-large-latest',
    description: 'Model used for translation',
  })
  model: string;

  @ApiProperty({
    type: Number,
    example: 920,
    description: 'Processing time in milliseconds',
  })
  processingTime: number;

  @ApiProperty({
    type: Date,
    example: '2023-01-01T00:00:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    type: Date,
    example: '2023-01-01T00:00:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;

  constructor() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
