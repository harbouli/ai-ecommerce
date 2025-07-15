import { Product } from '../../../../domain/product';
import { ProductWeaviateSchema } from '../entities/product.schema';

export class ProductWeaviateMapper {
  public static toDomain(raw: ProductWeaviateSchema): Product {
    const domainEntity = new Product();

    domainEntity.id = raw.id || '';
    domainEntity.name = raw.name;
    domainEntity.description = raw.description;
    domainEntity.slug = raw.slug;
    domainEntity.price = raw.price;
    domainEntity.costPrice = raw.costPrice;
    domainEntity.salePrice = raw.salePrice;
    domainEntity.stock = raw.stock;
    domainEntity.weight = raw.weight;
    domainEntity.dimensions = raw.dimensions;
    domainEntity.color = raw.color;
    domainEntity.size = raw.size;
    domainEntity.isActive = raw.isActive;
    domainEntity.isFeatured = raw.isFeatured;
    domainEntity.isDigital = raw.isDigital;
    domainEntity.metaTitle = raw.metaTitle;
    domainEntity.metaDescription = raw.metaDescription;
    domainEntity.publishedAt = raw.publishedAt;
    domainEntity.expiresAt = raw.expiresAt;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    return domainEntity;
  }

  public static toPersistence(domainEntity: Product): ProductWeaviateSchema {
    const persistenceSchema = new ProductWeaviateSchema();

    if (domainEntity.id) {
      persistenceSchema.id = domainEntity.id;
    }
    persistenceSchema.name = domainEntity.name;
    persistenceSchema.description = domainEntity.description;
    persistenceSchema.slug = domainEntity.slug;
    persistenceSchema.price = domainEntity.price;
    persistenceSchema.costPrice = domainEntity.costPrice;
    persistenceSchema.salePrice = domainEntity.salePrice;
    persistenceSchema.stock = domainEntity.stock;
    persistenceSchema.weight = domainEntity.weight;
    persistenceSchema.dimensions = domainEntity.dimensions;
    persistenceSchema.color = domainEntity.color;
    persistenceSchema.size = domainEntity.size;
    persistenceSchema.isActive = domainEntity.isActive;
    persistenceSchema.isFeatured = domainEntity.isFeatured;
    persistenceSchema.isDigital = domainEntity.isDigital;
    persistenceSchema.metaTitle = domainEntity.metaTitle;
    persistenceSchema.metaDescription = domainEntity.metaDescription;
    persistenceSchema.publishedAt = domainEntity.publishedAt;
    persistenceSchema.expiresAt = domainEntity.expiresAt;
    persistenceSchema.createdAt = domainEntity.createdAt || new Date();
    persistenceSchema.updatedAt = domainEntity.updatedAt || new Date();

    // Create vectorized text for semantic search
    persistenceSchema.vectorizedText = [
      domainEntity.name,
      domainEntity.description,
      domainEntity.metaTitle,
      domainEntity.metaDescription,
      domainEntity.color,
      domainEntity.size,
    ]
      .filter(Boolean)
      .join(' ');

    return persistenceSchema;
  }
}
