import { BaseGraphNode } from './base-graph-node';

export class BrandNode extends BaseGraphNode {
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  countryOfOrigin?: string;
  foundedYear?: number;
  isActive: boolean;

  constructor(data: Partial<BrandNode>) {
    super('Brand', data.id);
    Object.assign(this, data);
  }
}
