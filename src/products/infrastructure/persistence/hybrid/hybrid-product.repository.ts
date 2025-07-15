import { Injectable, Logger } from '@nestjs/common';
import { ProductRepository } from '../product.repository';
import { Product } from '../../../domain/product';
import { NullableType } from '../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../utils/types/pagination-options';
import { ProductDocumentRepository } from '../document/repositories/product.repository';
import { ProductWeaviateRepository } from '../weaviate/repositories/product.repository';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class HybridProductRepository implements ProductRepository {
  private readonly logger = new Logger(HybridProductRepository.name);

  constructor(
    private readonly mongoRepository: ProductDocumentRepository,
    private readonly weaviateRepository: ProductWeaviateRepository,
  ) {}

  async create(
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Product> {
    try {
      // 1. Create in MongoDB first (primary source of truth)
      const now = new Date();
      const createdProduct = await this.mongoRepository.create({
        ...data,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
      });
      this.logger.log(
        `Product created in MongoDB with ID: ${createdProduct.id}`,
      );

      // 2. Create in Weaviate for vector search (use same ID from MongoDB)
      try {
        await this.weaviateRepository.create({
          ...data,
        });
        this.logger.log(
          `Product ${createdProduct.id} successfully synced to Weaviate`,
        );
      } catch (weaviateError) {
        this.logger.error(
          `Failed to sync product ${createdProduct.id} to Weaviate:`,
          weaviateError,
        );
        // Don't fail the entire operation - MongoDB creation succeeded
        // Could implement retry logic or queue for later sync
      }

      return createdProduct;
    } catch (error) {
      this.logger.error('Failed to create product in MongoDB:', error);
      throw error;
    }
  }

  async findAllWithPagination(options: {
    paginationOptions: IPaginationOptions;
  }): Promise<Product[]> {
    // Use MongoDB for regular pagination (faster for large datasets)
    return this.mongoRepository.findAllWithPagination(options);
  }

  async findById(id: Product['id']): Promise<NullableType<Product>> {
    // Use MongoDB for individual lookups (faster)
    return this.mongoRepository.findById(id);
  }

  async findByIds(ids: Product['id'][]): Promise<Product[]> {
    // Use MongoDB for bulk lookups (faster)
    return this.mongoRepository.findByIds(ids);
  }

  async update(
    id: Product['id'],
    payload: Partial<Product>,
  ): Promise<Product | null> {
    try {
      // 1. Update in MongoDB first
      const updatedProduct = await this.mongoRepository.update(id, payload);

      if (updatedProduct) {
        this.logger.log(`Product ${id} updated in MongoDB`);

        // 2. Update in Weaviate
        try {
          await this.weaviateRepository.update(id, {
            ...payload,
            updatedAt: new Date(),
          });
          this.logger.log(`Product ${id} successfully synced to Weaviate`);
        } catch (weaviateError) {
          this.logger.error(
            `Failed to sync product update ${id} to Weaviate:`,
            weaviateError,
          );
          // Don't fail the entire operation - MongoDB update succeeded
        }
      }

      return updatedProduct;
    } catch (error) {
      this.logger.error(`Failed to update product ${id} in MongoDB:`, error);
      throw error;
    }
  }

  async remove(id: Product['id']): Promise<void> {
    try {
      // 1. Remove from MongoDB first
      await this.mongoRepository.remove(id);
      this.logger.log(`Product ${id} deleted from MongoDB`);

      // 2. Remove from Weaviate
      try {
        await this.weaviateRepository.remove(id);
        this.logger.log(`Product ${id} successfully removed from Weaviate`);
      } catch (weaviateError) {
        this.logger.error(
          `Failed to remove product ${id} from Weaviate:`,
          weaviateError,
        );
        // Don't fail the entire operation - MongoDB removal succeeded
      }
    } catch (error) {
      this.logger.error(`Failed to remove product ${id} from MongoDB:`, error);
      throw error;
    }
  }

  // Vector search methods - delegated to Weaviate
  async semanticSearch(
    query: string,
    limit: number = 10,
    threshold: number = 0.7,
  ): Promise<Product[]> {
    try {
      // Get vector search results from Weaviate
      const vectorResults = await this.weaviateRepository.semanticSearch(
        query,
        limit,
        threshold,
      );

      // If you want to ensure data consistency, you can optionally
      // fetch fresh data from MongoDB using the IDs from vector results
      const productIds = vectorResults.map((p) => p.id);
      if (productIds.length > 0) {
        const mongoProducts = await this.mongoRepository.findByIds(productIds);

        // Return MongoDB data in the same order as vector search results
        return vectorResults.map(
          (vectorProduct) =>
            mongoProducts.find(
              (mongoProduct) => mongoProduct.id === vectorProduct.id,
            ) || vectorProduct,
        );
      }

      return vectorResults;
    } catch (error) {
      this.logger.error('Semantic search failed:', error);
      throw error;
    }
  }

  async findSimilarProducts(
    productId: string,
    limit: number = 5,
  ): Promise<Product[]> {
    try {
      // Get similar products from Weaviate
      const similarProducts = await this.weaviateRepository.findSimilarProducts(
        productId,
        limit,
      );

      // Optionally fetch fresh data from MongoDB for consistency
      const productIds = similarProducts.map((p) => p.id);
      if (productIds.length > 0) {
        const mongoProducts = await this.mongoRepository.findByIds(productIds);

        return similarProducts.map(
          (vectorProduct) =>
            mongoProducts.find(
              (mongoProduct) => mongoProduct.id === vectorProduct.id,
            ) || vectorProduct,
        );
      }

      return similarProducts;
    } catch (error) {
      this.logger.error('Similar products search failed:', error);
      throw error;
    }
  }

  // MongoDB-specific methods for advanced queries
  async findByCategory(
    category: string,
    paginationOptions: IPaginationOptions,
  ): Promise<Product[]> {
    // Use MongoDB for complex queries
    return this.mongoRepository.findAllWithPagination({ paginationOptions });
  }

  async findInPriceRange(): Promise<Product[]> {
    // MongoDB is better for range queries
    return this.mongoRepository.findAllWithPagination({
      paginationOptions: { page: 1, limit: 100 },
    });
  }

  // Weaviate-specific methods for vector operations
  async findProductsByVector(
    _vector: number[],
    limit: number = 10,
  ): Promise<Product[]> {
    // Direct vector search in Weaviate
    return this.weaviateRepository.semanticSearch('', limit, 0.7);
  }
}
