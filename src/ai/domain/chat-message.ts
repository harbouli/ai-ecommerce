import { ApiProperty } from '@nestjs/swagger';

export class ChatMessage {
  @ApiProperty({
    type: String,
    example: 'msg_123',
    description: 'Unique identifier for the chat message',
  })
  id: string;

  @ApiProperty({
    enum: ['user', 'assistant', 'system'],
    example: 'user',
    description: 'Role of the message sender',
  })
  role: 'user' | 'assistant' | 'system';

  @ApiProperty({
    type: String,
    example: 'Hello, I need help finding a laptop',
    description: 'Content of the chat message',
  })
  content: string;

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
    this.metadata = {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
