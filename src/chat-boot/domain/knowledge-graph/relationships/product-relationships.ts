import { BaseRelationship } from './base-relationship';
import { RelationshipType } from './relationship-types';

export class ProductCategoryRelationship extends BaseRelationship {
  constructor(
    productId: string,
    categoryId: string,
    isPrimary: boolean = true,
    confidence: number = 1.0,
  ) {
    super(
      RelationshipType.BELONGS_TO_CATEGORY,
      productId,
      categoryId,
      'Product',
      'Category',
      { isPrimary },
      1.0,
      confidence,
    );
  }
}

export class ProductFeatureRelationship extends BaseRelationship {
  constructor(
    productId: string,
    featureId: string,
    value?: string,
    importance: number = 1.0,
    confidence: number = 1.0,
  ) {
    super(
      RelationshipType.HAS_FEATURE,
      productId,
      featureId,
      'Product',
      'Feature',
      { value, importance },
      importance,
      confidence,
    );
  }
}

export class ProductSimilarityRelationship extends BaseRelationship {
  constructor(
    productId1: string,
    productId2: string,
    similarityScore: number,
    reasons: string[] = [],
  ) {
    super(
      RelationshipType.SIMILAR_TO,
      productId1,
      productId2,
      'Product',
      'Product',
      { reasons },
      similarityScore,
      similarityScore,
    );
  }
}

export class ProductBundleRelationship extends BaseRelationship {
  constructor(
    productId1: string,
    productId2: string,
    bundleDiscount: number = 0,
    bundleType: 'complement' | 'accessory' | 'upgrade' = 'complement',
  ) {
    super(
      RelationshipType.BUNDLE_WITH,
      productId1,
      productId2,
      'Product',
      'Product',
      { bundleDiscount, bundleType },
      1.0,
      1.0,
    );
  }
}
