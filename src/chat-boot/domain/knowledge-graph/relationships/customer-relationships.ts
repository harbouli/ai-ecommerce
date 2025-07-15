import { BaseRelationship } from './base-relationship';
import { RelationshipType } from './relationship-types';

export class CustomerPurchaseRelationship extends BaseRelationship {
  constructor(
    customerId: string,
    productId: string,
    purchaseDate: Date,
    quantity: number = 1,
    price: number,
    orderId?: string,
  ) {
    super(
      RelationshipType.PURCHASED,
      customerId,
      productId,
      'CustomerProfile',
      'Product',
      { purchaseDate: purchaseDate.toISOString(), quantity, price, orderId },
      1.0,
      1.0,
    );
  }
}

export class CustomerViewRelationship extends BaseRelationship {
  constructor(
    customerId: string,
    productId: string,
    viewDate: Date,
    duration: number = 0,
    source: string = 'web',
  ) {
    super(
      RelationshipType.VIEWED,
      customerId,
      productId,
      'CustomerProfile',
      'Product',
      { viewDate: viewDate.toISOString(), duration, source },
      0.3,
      0.8,
    );
  }
}

export class CustomerPreferenceRelationship extends BaseRelationship {
  constructor(
    customerId: string,
    nodeId: string,
    nodeType: 'Category' | 'Brand' | 'Feature',
    preferenceStrength: number,
    lastUpdated: Date = new Date(),
  ) {
    const relationshipType =
      nodeType === 'Category'
        ? RelationshipType.PREFERS_CATEGORY
        : RelationshipType.PREFERS_BRAND;

    super(
      relationshipType,
      customerId,
      nodeId,
      'CustomerProfile',
      nodeType,
      { preferenceStrength, lastUpdated: lastUpdated.toISOString() },
      preferenceStrength,
      0.9,
    );
  }
}
