import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, now, Types } from 'mongoose';

export type MessageDocument = MessageSchema & Document;

@Schema({
  timestamps: true,
})
export class MessageSchema {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId })
  chatId: Types.ObjectId;

  @Prop({ required: true, maxlength: 2000 })
  content: string;

  @Prop({ required: true, enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  @Prop({ type: Object })
  metadata?: Record<string, any>;
  @Prop({ default: now })
  createdAt: Date;

  @Prop({ default: now })
  updatedAt: Date;
}

export const MessageSchemaFactory = SchemaFactory.createForClass(MessageSchema);
