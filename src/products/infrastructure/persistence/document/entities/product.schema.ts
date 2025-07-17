import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { now, HydratedDocument } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';

export type ProductSchemaDocument = HydratedDocument<ProductSchemaClass>;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    getters: true,
  },
})
export class ProductSchemaClass extends EntityDocumentHelper {
  @Prop({
    type: String,
    required: true,
    index: true,
  })
  name: string;

  @Prop({
    type: String,
  })
  description?: string | null;

  // ADD THIS MISSING FIELD
  @Prop({
    type: String,
    index: true,
  })
  slug?: string | null;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  price: number;

  @Prop({
    type: Number,
    min: 0,
  })
  costPrice?: number | null;

  @Prop({
    type: Number,
    min: 0,
  })
  salePrice?: number | null;

  @Prop({
    type: Number,
    min: 0,
    default: 0,
  })
  stock?: number | null;

  @Prop({
    type: Number,
    min: 0,
  })
  weight?: number | null;

  @Prop({
    type: String,
  })
  dimensions?: string | null;

  @Prop({
    type: String,
  })
  color?: string | null;

  @Prop({
    type: String,
  })
  size?: string | null;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive?: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  isFeatured?: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  isDigital?: boolean;

  @Prop({
    type: String,
  })
  metaTitle?: string | null;

  @Prop({
    type: String,
  })
  metaDescription?: string | null;

  @Prop({
    type: Date,
  })
  publishedAt?: Date | null;

  @Prop({
    type: Date,
  })
  expiresAt?: Date | null;

  // ADD THESE MISSING FIELDS FOR NEO4J SUPPORT
  @Prop({
    type: String,
    index: true,
  })
  category?: string | null;

  @Prop({
    type: String,
    index: true,
  })
  brand?: string | null;

  @Prop({
    type: [String],
    default: [],
  })
  tags?: string[];

  @Prop({ default: now })
  createdAt: Date;

  @Prop({ default: now })
  updatedAt: Date;
}

export const ProductSchema = SchemaFactory.createForClass(ProductSchemaClass);

// Create indexes for better query performance
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ category: 1, brand: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ isActive: 1, isFeatured: 1 });
ProductSchema.index({ tags: 1 });
ProductSchema.index({ createdAt: -1 });
