import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { now, HydratedDocument } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';
import { UserSchemaClass } from '../../../../../users/infrastructure/persistence/document/entities/user.schema';

export type ChatSchemaDocument = HydratedDocument<ChatSchemaClass>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    getters: true,
  },
})
export class ChatSchemaClass extends EntityDocumentHelper {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: UserSchemaClass.name,
    required: true,
    index: true,
  })
  userId: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  sessionId: string;

  @Prop({
    type: String,
    required: true,
  })
  title: string;

  @Prop({
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'ABANDONED'],
    default: 'ACTIVE',
    index: true,
  })
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

  @Prop({
    type: Date,
    default: now,
  })
  lastActivity: Date;

  @Prop({
    type: mongoose.Schema.Types.Mixed,
    default: {},
  })
  metadata?: Record<string, any>;

  @Prop({ default: now })
  createdAt: Date;

  @Prop({ default: now })
  updatedAt: Date;

  @Prop()
  deletedAt?: Date;
}

export const ChatSchema = SchemaFactory.createForClass(ChatSchemaClass);

// Create indexes for better query performance
ChatSchema.index({ userId: 1, status: 1 });
ChatSchema.index({ sessionId: 1 });
ChatSchema.index({ userId: 1, lastActivity: -1 });
ChatSchema.index({ createdAt: -1 });
