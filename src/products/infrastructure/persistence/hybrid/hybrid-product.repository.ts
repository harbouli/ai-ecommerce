import { Injectable, Logger } from '@nestjs/common';
import { ProductRepository } from '../product.repository';
import { Product } from '../../../domain/product';
import { NullableType } from '../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../utils/types/pagination-options';
import { ProductDocumentRepository } from '../document/repositories/product.repository';
import { ProductWeaviateRepository } from '../weaviate/repositories/product.repository';
import { ProductGraphRepository } from '../graph/repositories/product-graph.repository';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class HybridProductRepository implements ProductRepository {
  private readonly logger = new Logger(HybridProductRepository.name);

  constructor(
    private readonly mongoRepository: ProductDocumentRepository,
    private readonly weaviateRepository: ProductWeaviateRepository,
    private readonly graphRepository: ProductGraphRepository,
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
      }

      // 3. Create in Neo4j for graph relationships
      try {
        await this.graphRepository.create(data);
        this.logger.log(
          `Product ${createdProduct.id} successfully synced to Neo4j`,
        );
      } catch (graphError) {
        this.logger.error(
          `Failed to sync product ${createdProduct.id} to Neo4j:`,
          graphError,
        );
        // Don't fail the entire operation - MongoDB creation succeeded
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
        }

        // 3. Update in Neo4j
        try {
          await this.graphRepository.update(id, payload);
          this.logger.log(`Product ${id} successfully synced to Neo4j`);
        } catch (graphError) {
          this.logger.error(
            `Failed to sync product update ${id} to Neo4j:`,
            graphError,
          );
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
      }

      // 3. Remove from Neo4j
      try {
        await this.graphRepository.remove(id);
        this.logger.log(`Product ${id} successfully removed from Neo4j`);
      } catch (graphError) {
        this.logger.error(
          `Failed to remove product ${id} from Neo4j:`,
          graphError,
        );
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
      // Try Neo4j first for graph-based relationships
      const graphSimilar = await this.graphRepository.findSimilarProducts(
        productId,
        limit,
      );

      if (graphSimilar.length > 0) {
        this.logger.log(
          `Found ${graphSimilar.length} similar products from Neo4j graph relationships`,
        );
        return graphSimilar;
      }

      // Fallback to Weaviate vector similarity
      const vectorSimilar = await this.findSimilarProducts(productId, limit);

      // Optionally fetch fresh data from MongoDB for consistency
      const productIds = vectorSimilar.map((p) => p.id);
      if (productIds.length > 0) {
        const mongoProducts = await this.mongoRepository.findByIds(productIds);

        return vectorSimilar.map(
          (vectorProduct) =>
            mongoProducts.find(
              (mongoProduct) => mongoProduct.id === vectorProduct.id,
            ) || vectorProduct,
        );
      }

      return vectorSimilar;
    } catch (error) {
      this.logger.error('Similar products search failed:', error);
      throw error;
    }
  }

  // Graph-specific methods using Neo4j
  async findFrequentlyBoughtTogether(
    productId: string,
    limit: number = 5,
  ): Promise<Product[]> {
    try {
      return await this.graphRepository.findFrequentlyBoughtTogether(
        productId,
        limit,
      );
    } catch (error) {
      this.logger.error('Frequently bought together search failed:', error);
      return [];
    }
  }

  async createProductRelationship(
    fromId: string,
    toId: string,
    type:
      | 'SIMILAR_TO'
      | 'FREQUENTLY_BOUGHT_WITH'
      | 'RELATED_TO'
      | 'COMPLEMENT_OF',
    properties?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.graphRepository.createProductRelationship(
        fromId,
        toId,
        type,
        properties,
      );
      this.logger.log(
        `Created ${type} relationship between ${fromId} and ${toId}`,
      );
    } catch (error) {
      this.logger.error('Failed to create product relationship:', error);
      throw error;
    }
  }

  async getProductRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<Product[]> {
    try {
      return await this.graphRepository.getProductRecommendations(
        userId,
        limit,
      );
    } catch (error) {
      this.logger.error('Product recommendations failed:', error);
      return [];
    }
  }

  async getPopularProducts(limit: number = 10): Promise<Product[]> {
    try {
      return await this.graphRepository.getPopularProducts(limit);
    } catch (error) {
      this.logger.error('Popular products search failed:', error);
      // Fallback to MongoDB
      return this.mongoRepository.findAllWithPagination({
        paginationOptions: { page: 1, limit },
      });
    }
  }

  async getProductInsights(productId: string): Promise<{
    similar: Product[];
    frequentlyBoughtWith: Product[];
    category: string | null;
    popularInCategory: Product[];
  }> {
    try {
      const [similar, frequentlyBoughtWith, product] = await Promise.all([
        this.findSimilarProducts(productId, 5),
        this.findFrequentlyBoughtTogether(productId, 5),
        this.findById(productId),
      ]);

      let popularInCategory: Product[] = [];
      if (product?.category) {
        popularInCategory = await this.findByCategory(product.category, {
          page: 1,
          limit: 5,
        });
      }

      return {
        similar,
        frequentlyBoughtWith,
        category: product?.category || null,
        popularInCategory,
      };
    } catch (error) {
      this.logger.error('Failed to get product insights:', error);
      return {
        similar: [],
        frequentlyBoughtWith: [],
        category: null,
        popularInCategory: [],
      };
    }
  }

  async syncProductToAllDatabases(productId: string): Promise<void> {
    try {
      const product = await this.mongoRepository.findById(productId);
      if (!product) {
        throw new Error(`Product ${productId} not found in MongoDB`);
      }

      // Sync to Weaviate
      await this.weaviateRepository.update(productId, product);

      // Sync to Neo4j
      await this.graphRepository.update(productId, product);

      this.logger.log(`Product ${productId} synced to all databases`);
    } catch (error) {
      this.logger.error(`Failed to sync product ${productId}:`, error);
      throw error;
    }
  }

  // MongoDB-specific methods for advanced queries
  async findByCategory(
    category: string,
    paginationOptions: IPaginationOptions,
  ): Promise<Product[]> {
    try {
      // Try Neo4j first for category relationships
      const graphProducts = await this.graphRepository.findProductsByCategory(
        category,
        paginationOptions.limit,
      );

      if (graphProducts.length > 0) {
        return graphProducts;
      }

      // Fallback to MongoDB
      return this.mongoRepository.findAllWithPagination({ paginationOptions });
    } catch (error) {
      this.logger.error('Category search failed:', error);
      return this.mongoRepository.findAllWithPagination({ paginationOptions });
    }
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

  // Enhanced hybrid search combining all three databases
  async hybridSearch(
    query: string,
    filters: {
      minPrice?: number;
      maxPrice?: number;
      category?: string;
      isActive?: boolean;
    },
    limit: number = 10,
  ): Promise<Product[]> {
    try {
      // 1. Get semantic search results from Weaviate
      const vectorResults = await this.weaviateRepository.semanticSearch(
        query,
        limit * 2,
        0.6,
      );

      // 2. If category filter is provided, also get category-based results from Neo4j
      let categoryResults: Product[] = [];
      if (filters.category) {
        categoryResults = await this.graphRepository.findProductsByCategory(
          filters.category,
          limit,
        );
      }

      // 3. Combine and deduplicate results
      const combinedIds = new Set([
        ...vectorResults.map((p) => p.id),
        ...categoryResults.map((p) => p.id),
      ]);

      // 4. Fetch fresh data from MongoDB and apply filters
      const mongoProducts = await this.mongoRepository.findByIds(
        Array.from(combinedIds),
      );

      // Apply price and status filters
      const filteredProducts = mongoProducts.filter((product) => {
        if (filters.minPrice && product.price < filters.minPrice) return false;
        if (filters.maxPrice && product.price > filters.maxPrice) return false;
        if (
          filters.isActive !== undefined &&
          product.isActive !== filters.isActive
        )
          return false;
        return true;
      });

      // Sort by relevance (maintain vector search order for the first results)
      const vectorIds = vectorResults.map((p) => p.id);
      filteredProducts.sort((a, b) => {
        const aIndex = vectorIds.indexOf(a.id);
        const bIndex = vectorIds.indexOf(b.id);

        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return 0;
      });

      return filteredProducts.slice(0, limit);
    } catch (error) {
      this.logger.error('Hybrid search failed:', error);
      // Fallback to MongoDB
      return this.mongoRepository.findAllWithPagination({
        paginationOptions: { page: 1, limit },
      });
    }
  }
}
