import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AiSessionType } from '../../../../domain/ai-session';

export type AiSessionDocument = AiSessionSchema & Document;

@Schema({
  timestamps: true,
  collection: 'ai_sessions',
})
export class AiSessionSchema {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ required: true, maxlength: 100 })
  title: string;

  @Prop({ required: true, type: String })
  userId: string;

  @Prop({ required: true, enum: Object.values(AiSessionType) })
  sessionType: AiSessionType;

  @Prop({ maxlength: 1000 })
  context?: string;

  @Prop({ type: Object })
  configuration?: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Array, default: [] })
  interactions: Array<{
    _id: Types.ObjectId;
    interactionType: string;
    input: Record<string, any>;
    output: Record<string, any>;
    metadata?: Record<string, any>;
    createdAt: Date;
  }>;

  @Prop({ default: Date.now })
  lastActivity: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const AiSessionSchemaFactory =
  SchemaFactory.createForClass(AiSessionSchema);

// Add indexes for better performance
AiSessionSchemaFactory.index({ userId: 1, createdAt: -1 });
AiSessionSchemaFactory.index({ userId: 1, sessionType: 1 });
AiSessionSchemaFactory.index({ lastActivity: -1 });
