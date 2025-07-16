import { ApiProperty } from '@nestjs/swagger';

export class AIModelConfig {
  @ApiProperty({
    type: String,
    example: 'config_123',
    description: 'Unique identifier for the model configuration',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'Mistral Large Chat',
    description: 'Human-readable name for the model configuration',
  })
  name: string;

  @ApiProperty({
    enum: ['mistral', 'openai', 'claude', 'custom'],
    example: 'mistral',
    description: 'AI provider/platform',
  })
  provider: 'mistral' | 'openai' | 'claude' | 'custom';

  @ApiProperty({
    type: String,
    example: 'mistral-large-latest',
    description: 'Specific model identifier',
  })
  modelId: string;

  @ApiProperty({
    type: Number,
    example: 0.7,
    description: 'Model temperature setting (0-1)',
  })
  temperature: number;

  @ApiProperty({
    type: Number,
    example: 1000,
    description: 'Maximum tokens per response',
  })
  maxTokens: number;

  @ApiProperty({
    type: Boolean,
    example: true,
    description: 'Whether this configuration is active',
  })
  isActive: boolean;

  @ApiProperty({
    type: [String],
    example: ['chat', 'completion', 'embedding'],
    description: 'Model capabilities',
  })
  capabilities: string[];

  metadata: Record<string, any>;

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
    this.capabilities = [];
    this.metadata = {};
    this.temperature = 0.7;
    this.maxTokens = 1000;
    this.isActive = true;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
