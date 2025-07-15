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
    type: Date,
  })
  expiresAt?: Date | null;

  @Prop({
    type: Date,
  })
  publishedAt?: Date | null;

  @Prop({
    type: String,
  })
  metaDescription?: string | null;

  @Prop({
    type: String,
  })
  metaTitle?: string | null;

  @Prop({
    type: Boolean,
  })
  isDigital?: boolean;

  @Prop({
    type: Boolean,
  })
  isFeatured?: boolean;

  @Prop({
    type: Boolean,
  })
  isActive?: boolean;

  @Prop({
    type: String,
  })
  size?: string | null;

  @Prop({
    type: String,
  })
  color?: string | null;

  @Prop({
    type: String,
  })
  dimensions?: string | null;

  @Prop({
    type: Number,
  })
  weight?: number | null;

  @Prop({
    type: Number,
  })
  stock?: number | null;

  @Prop({
    type: Number,
  })
  salePrice?: number | null;

  @Prop({
    type: Number,
  })
  costPrice?: number | null;

  @Prop({
    type: Number,
  })
  price: number;

  @Prop({
    type: String,
  })
  description?: string | null;

  @Prop({
    type: String,
  })
  name: string;

  @Prop({ default: now })
  createdAt: Date;

  @Prop({ default: now })
  updatedAt: Date;
}

export const ProductSchema = SchemaFactory.createForClass(ProductSchemaClass);
