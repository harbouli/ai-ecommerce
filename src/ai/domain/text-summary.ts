import { ApiProperty } from '@nestjs/swagger';

export class TextSummary {
  @ApiProperty({
    type: String,
    example: 'summary_123',
    description: 'Unique identifier for the text summary',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'This is a concise summary of the original text content.',
    description: 'Generated summary text',
  })
  summary: string;

  @ApiProperty({
    type: [String],
    example: ['Key point 1', 'Key point 2', 'Key point 3'],
    description: 'Main key points from the text',
  })
  keyPoints: string[];

  @ApiProperty({
    enum: ['positive', 'negative', 'neutral'],
    example: 'positive',
    description: 'Overall sentiment of the text',
  })
  sentiment: 'positive' | 'negative' | 'neutral';

  @ApiProperty({
    type: Number,
    example: 0.89,
    description: 'Confidence score for the summary (0-1)',
  })
  confidence: number;

  @ApiProperty({
    type: String,
    example: 'This is the original text that was summarized...',
    description: 'Original text that was summarized',
  })
  sourceText: string;

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
    this.keyPoints = [];
    this.sentiment = 'neutral';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
