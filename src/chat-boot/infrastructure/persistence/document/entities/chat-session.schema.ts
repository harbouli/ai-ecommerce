import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, now, Types } from 'mongoose';
import { MessageDocument, MessageSchema } from './message.schema';

export type ChatSessionDocument = ChatSessionSchema & Document;

@Schema({
  timestamps: true,
  collection: 'chat_sessions',
})
export class ChatSessionSchema {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ required: true, maxlength: 100 })
  title: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ maxlength: 500 })
  context?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [MessageSchema], default: [] })
  messages: MessageDocument[];

  @Prop({ default: Date.now })
  lastActivity: Date;

  @Prop({ default: now })
  createdAt: Date;

  @Prop({ default: now })
  updatedAt: Date;
}

export const ChatSessionSchemaFactory =
  SchemaFactory.createForClass(ChatSessionSchema);

// Add indexes
ChatSessionSchemaFactory.index({ userId: 1, createdAt: -1 });
ChatSessionSchemaFactory.index({ userId: 1, isActive: 1 });
ChatSessionSchemaFactory.index({ lastActivity: -1 });
