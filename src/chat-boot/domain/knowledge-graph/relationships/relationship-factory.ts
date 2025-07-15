import { CategoryHierarchyRelationship } from './category-relationships';
import { CustomerPurchaseRelationship } from './customer-relationships';
import {
  ProductCategoryRelationship,
  ProductFeatureRelationship,
  ProductSimilarityRelationship,
} from './product-relationships';

export class RelationshipFactory {
  static createProductCategoryRelationship(
    productId: string,
    categoryId: string,
    isPrimary: boolean = true,
  ): ProductCategoryRelationship {
    return new ProductCategoryRelationship(productId, categoryId, isPrimary);
  }

  static createProductFeatureRelationship(
    productId: string,
    featureId: string,
    value?: string,
    importance: number = 1.0,
  ): ProductFeatureRelationship {
    return new ProductFeatureRelationship(
      productId,
      featureId,
      value,
      importance,
    );
  }

  static createCustomerPurchaseRelationship(
    customerId: string,
    productId: string,
    purchaseDate: Date,
    quantity: number,
    price: number,
  ): CustomerPurchaseRelationship {
    return new CustomerPurchaseRelationship(
      customerId,
      productId,
      purchaseDate,
      quantity,
      price,
    );
  }

  static createProductSimilarityRelationship(
    productId1: string,
    productId2: string,
    similarityScore: number,
    reasons: string[] = [],
  ): ProductSimilarityRelationship {
    return new ProductSimilarityRelationship(
      productId1,
      productId2,
      similarityScore,
      reasons,
    );
  }

  static createCategoryHierarchyRelationship(
    parentCategoryId: string,
    childCategoryId: string,
    level: number = 1,
  ): CategoryHierarchyRelationship {
    return new CategoryHierarchyRelationship(
      parentCategoryId,
      childCategoryId,
      level,
    );
  }
}
