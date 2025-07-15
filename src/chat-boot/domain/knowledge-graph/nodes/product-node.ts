import { BaseGraphNode } from './base-graph-node';

export class ProductNode extends BaseGraphNode {
  name: string;
  description?: string;
  price: number;
  costPrice?: number;
  salePrice?: number;
  stock: number;
  weight?: number;
  dimensions?: string;
  color?: string;
  size?: string;
  isActive: boolean;
  isFeatured: boolean;
  isDigital: boolean;
  metaTitle?: string;
  metaDescription?: string;
  publishedAt?: Date;
  expiresAt?: Date;

  constructor(data: Partial<ProductNode>) {
    super('Product', data.id);
    Object.assign(this, data);
  }
}
