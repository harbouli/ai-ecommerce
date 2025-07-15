import { BaseRelationship } from './base-relationship';
import { RelationshipType } from './relationship-types';

export class CategoryHierarchyRelationship extends BaseRelationship {
  constructor(
    parentCategoryId: string,
    childCategoryId: string,
    level: number = 1,
  ) {
    super(
      RelationshipType.PARENT_CATEGORY,
      parentCategoryId,
      childCategoryId,
      'Category',
      'Category',
      { level },
      1.0,
      1.0,
    );
  }
}

export class CategoryRelatedRelationship extends BaseRelationship {
  constructor(
    categoryId1: string,
    categoryId2: string,
    relationStrength: number = 0.5,
    reason: string = 'cross-selling',
  ) {
    super(
      RelationshipType.RELATED_CATEGORY,
      categoryId1,
      categoryId2,
      'Category',
      'Category',
      { reason },
      relationStrength,
      0.8,
    );
  }
}
