import { BaseGraphNode } from './base-graph-node';

export class CategoryNode extends BaseGraphNode {
  name: string;
  description?: string;
  slug: string;
  parentId?: string;
  level: number;
  isActive: boolean;
  sortOrder: number;
  metaTitle?: string;
  metaDescription?: string;
  imageUrl?: string;

  constructor(data: Partial<CategoryNode>) {
    super('Category', data.id);
    Object.assign(this, data);
  }
}
