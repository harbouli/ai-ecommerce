import { BaseGraphNode } from './base-graph-node';

export class CustomerProfileNode extends BaseGraphNode {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  age?: number;
  gender?: string;
  location?: string;
  preferredLanguage?: string;
  customerSegment: 'premium' | 'regular' | 'budget' | 'enterprise';
  lifetimeValue: number;
  totalOrders: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  registrationDate: Date;

  constructor(data: Partial<CustomerProfileNode>) {
    super('CustomerProfile', data.id);
    Object.assign(this, data);
  }
}
