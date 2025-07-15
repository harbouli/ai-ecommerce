import { BaseGraphNode } from './base-graph-node';

export class SupplierNode extends BaseGraphNode {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  country?: string;
  rating?: number;
  isActive: boolean;

  constructor(data: Partial<SupplierNode>) {
    super('Supplier', data.id);
    Object.assign(this, data);
  }
}
