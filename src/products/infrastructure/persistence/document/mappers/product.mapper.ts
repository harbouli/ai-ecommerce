import { Product } from '../../../../domain/product';
import { ProductSchemaClass } from '../entities/product.schema';

export class ProductMapper {
  public static toDomain(raw: ProductSchemaClass): Product {
    const domainEntity = new Product();

    // Basic identification
    domainEntity.id = raw._id.toString();
    domainEntity.name = raw.name;
    domainEntity.description = raw.description;
    domainEntity.slug = raw.slug;

    // Pricing
    domainEntity.price = raw.price;
    domainEntity.costPrice = raw.costPrice;
    domainEntity.salePrice = raw.salePrice;
    domainEntity.stock = raw.stock;

    // Physical attributes
    domainEntity.weight = raw.weight;
    domainEntity.dimensions = raw.dimensions;
    domainEntity.color = raw.color;
    domainEntity.size = raw.size;

    // Boolean flags
    domainEntity.isActive = raw.isActive;
    domainEntity.isFeatured = raw.isFeatured;
    domainEntity.isDigital = raw.isDigital;

    // SEO fields
    domainEntity.metaTitle = raw.metaTitle;
    domainEntity.metaDescription = raw.metaDescription;

    // Date fields
    domainEntity.publishedAt = raw.publishedAt;
    domainEntity.expiresAt = raw.expiresAt;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    // CRITICAL: Map the missing fields
    domainEntity.category = raw.category;
    domainEntity.brand = raw.brand;
    domainEntity.tags = raw.tags || [];

    return domainEntity;
  }

  public static toPersistence(domainEntity: Product): ProductSchemaClass {
    const persistenceSchema = new ProductSchemaClass();

    // Set _id if provided
    if (domainEntity.id) {
      persistenceSchema._id = domainEntity.id;
    }

    // Basic identification
    persistenceSchema.name = domainEntity.name;
    persistenceSchema.description = domainEntity.description;
    persistenceSchema.slug = domainEntity.slug;

    // Pricing
    persistenceSchema.price = domainEntity.price;
    persistenceSchema.costPrice = domainEntity.costPrice;
    persistenceSchema.salePrice = domainEntity.salePrice;
    persistenceSchema.stock = domainEntity.stock;

    // Physical attributes
    persistenceSchema.weight = domainEntity.weight;
    persistenceSchema.dimensions = domainEntity.dimensions;
    persistenceSchema.color = domainEntity.color;
    persistenceSchema.size = domainEntity.size;

    // Boolean flags
    persistenceSchema.isActive = domainEntity.isActive;
    persistenceSchema.isFeatured = domainEntity.isFeatured;
    persistenceSchema.isDigital = domainEntity.isDigital;

    // SEO fields
    persistenceSchema.metaTitle = domainEntity.metaTitle;
    persistenceSchema.metaDescription = domainEntity.metaDescription;

    // Date fields
    persistenceSchema.publishedAt = domainEntity.publishedAt;
    persistenceSchema.expiresAt = domainEntity.expiresAt;
    persistenceSchema.createdAt = domainEntity.createdAt;
    persistenceSchema.updatedAt = domainEntity.updatedAt;

    // CRITICAL: Map the missing fields
    persistenceSchema.category = domainEntity.category;
    persistenceSchema.brand = domainEntity.brand;
    persistenceSchema.tags = domainEntity.tags || [];

    return persistenceSchema;
  }
}
