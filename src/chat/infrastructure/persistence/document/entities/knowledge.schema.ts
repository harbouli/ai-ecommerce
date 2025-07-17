// src/chat/infrastructure/persistence/document/entities/knowledge.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { now, HydratedDocument } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';

export type KnowledgeSchemaDocument = HydratedDocument<KnowledgeSchemaClass>;
export type KnowledgeDocument = KnowledgeSchemaDocument; // Alias for backward compatibility

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    getters: true,
  },
})
export class KnowledgeSchemaClass extends EntityDocumentHelper {
  @Prop({
    type: String,
    enum: ['PRODUCT', 'CATEGORY', 'BRAND', 'FEATURE', 'CUSTOMER', 'CONCEPT'],
    required: true,
    index: true,
  })
  type: 'PRODUCT' | 'CATEGORY' | 'BRAND' | 'FEATURE' | 'CUSTOMER' | 'CONCEPT';

  @Prop({
    type: String,
    required: true,
    text: true, // Enable text search
  })
  name: string;

  @Prop({
    type: String,
    required: true,
    text: true,
  })
  description: string;

  @Prop({
    type: mongoose.Schema.Types.Mixed,
    default: {},
  })
  properties: Record<string, any>;

  @Prop({
    type: [Number],
    default: [],
  })
  vector?: number[];

  @Prop({ default: now })
  createdAt: Date;

  @Prop({ default: now })
  updatedAt: Date;

  @Prop()
  deletedAt?: Date;
}

export const KnowledgeSchema =
  SchemaFactory.createForClass(KnowledgeSchemaClass);

// Create indexes for better query performance
KnowledgeSchema.index({ type: 1, name: 1 });
KnowledgeSchema.index({ name: 'text', description: 'text' });
KnowledgeSchema.index({ createdAt: -1 });
KnowledgeSchema.index({ 'properties.category': 1 });
KnowledgeSchema.index({ 'properties.brand': 1 });
KnowledgeSchema.index({ 'properties.price': 1 });
KnowledgeSchema.index({ vector: 1 });
