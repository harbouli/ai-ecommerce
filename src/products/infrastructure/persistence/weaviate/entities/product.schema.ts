import { EntityWeaviateHelper } from '../../../../../utils/weaviate-entity-helper';

export class ProductWeaviateSchema extends EntityWeaviateHelper {
  id?: string;
  name: string;
  description?: string | null;
  slug?: string | null;
  price: number;
  costPrice?: number | null;
  salePrice?: number | null;
  stock?: number | null;
  weight?: number | null;
  dimensions?: string | null;
  color?: string | null;
  size?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
  isDigital?: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  vector?: number[];
  vectorizedText?: string;
}
