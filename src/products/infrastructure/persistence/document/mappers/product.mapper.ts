import { Product } from '../../../../domain/product';

import { ProductSchemaClass } from '../entities/product.schema';

export class ProductMapper {
  public static toDomain(raw: Omit<ProductSchemaClass, 'id'>): Product {
    const domainEntity = new Product();

    domainEntity.stock = raw.stock;

    domainEntity.salePrice = raw.salePrice;

    domainEntity.costPrice = raw.costPrice;

    domainEntity.price = raw.price;

    domainEntity.description = raw.description;

    domainEntity.name = raw.name;

    domainEntity.id = raw._id.toString();
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  public static toPersistence(domainEntity: Product): ProductSchemaClass {
    const persistenceSchema = new ProductSchemaClass();

    persistenceSchema.stock = domainEntity.stock;

    persistenceSchema.salePrice = domainEntity.salePrice;

    persistenceSchema.costPrice = domainEntity.costPrice;

    persistenceSchema.price = domainEntity.price;

    persistenceSchema.description = domainEntity.description;

    persistenceSchema.name = domainEntity.name;

    if (domainEntity.id) {
      persistenceSchema._id = domainEntity.id;
    }
    persistenceSchema.createdAt = domainEntity.createdAt;
    persistenceSchema.updatedAt = domainEntity.updatedAt;

    return persistenceSchema;
  }
}
