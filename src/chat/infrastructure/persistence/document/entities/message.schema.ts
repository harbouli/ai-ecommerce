import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { now, HydratedDocument } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';

export type MessageSchemaDocument = HydratedDocument<MessageSchemaClass>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    getters: true,
  },
})
export class MessageSchemaClass extends EntityDocumentHelper {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  })
  chatId: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  sessionId: string;

  @Prop({
    type: String,
    enum: ['USER', 'ASSISTANT', 'SYSTEM'],
    required: true,
    index: true,
  })
  type: 'USER' | 'ASSISTANT' | 'SYSTEM';

  @Prop({
    type: String,
    required: true,
    text: true, // Enable text search
  })
  content: string;

  @Prop({
    type: {
      processingTime: { type: Number },
      tokensUsed: { type: Number },
      model: { type: String },
      temperature: { type: Number },
      userId: { type: String },
      userAgent: { type: String },
      ipAddress: { type: String },
    },
    default: {},
  })
  metadata?: {
    processingTime?: number;
    tokensUsed?: number;
    model?: string;
    temperature?: number;
    userId?: string;
    userAgent?: string;
    ipAddress?: string;
  };

  @Prop({
    type: [
      {
        source: {
          type: String,
          enum: ['VECTOR', 'GRAPH', 'DOCUMENT', 'PRODUCT', 'KNOWLEDGE'],
          required: true,
        },
        content: { type: String, required: true },
        score: { type: Number, required: true },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],
    default: [],
  })
  context?: {
    source: 'VECTOR' | 'GRAPH' | 'DOCUMENT' | 'PRODUCT' | 'KNOWLEDGE';
    content: string;
    score: number;
    metadata: Record<string, any>;
  }[];

  @Prop({
    type: [
      {
        text: { type: String, required: true },
        type: {
          type: String,
          enum: [
            'PRODUCT',
            'CATEGORY',
            'BRAND',
            'PRICE',
            'FEATURE',
            'PERSON',
            'LOCATION',
          ],
          required: true,
        },
        confidence: { type: Number, required: true },
        startIndex: { type: Number },
        endIndex: { type: Number },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],
    default: [],
  })
  entities?: {
    text: string;
    type:
      | 'PRODUCT'
      | 'CATEGORY'
      | 'BRAND'
      | 'PRICE'
      | 'FEATURE'
      | 'PERSON'
      | 'LOCATION';
    confidence: number;
    startIndex?: number;
    endIndex?: number;
    metadata: Record<string, any>;
  }[];

  @Prop({
    type: String,
    index: true,
  })
  intent?: string;

  @Prop({
    type: Number,
    min: 0,
    max: 1,
  })
  confidence?: number;

  @Prop({
    type: Date,
    default: now,
    index: true,
  })
  timestamp: Date;

  @Prop({ default: now })
  createdAt: Date;

  @Prop({ default: now })
  updatedAt: Date;

  @Prop()
  deletedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(MessageSchemaClass);

// Create indexes for better query performance
MessageSchema.index({ chatId: 1, timestamp: -1 });
MessageSchema.index({ sessionId: 1, timestamp: -1 });
MessageSchema.index({ type: 1, timestamp: -1 });
MessageSchema.index({ intent: 1, timestamp: -1 });
MessageSchema.index({ 'entities.type': 1 });
MessageSchema.index({ 'metadata.userId': 1, timestamp: -1 });
MessageSchema.index({ createdAt: -1 });
MessageSchema.index({ content: 'text' });
