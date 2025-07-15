import { BaseGraphNode } from './base-graph-node';

export class OrderNode extends BaseGraphNode {
  orderNumber: string;
  customerId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  currency: string;
  orderDate: Date;
  shippingAddress?: string;
  paymentMethod?: string;

  constructor(data: Partial<OrderNode>) {
    super('Order', data.id);
    Object.assign(this, data);
  }
}
