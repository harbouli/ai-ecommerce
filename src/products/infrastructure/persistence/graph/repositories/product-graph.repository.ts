import { Injectable, Logger } from '@nestjs/common';
import { ProductRepository } from '../../product.repository';
import { Product } from '../../../../domain/product';
import {
  Neo4jService,
  ProductGraphNode,
} from '../../../../../database/neo4j/neo4j.service';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ProductGraphRepository implements ProductRepository {
  private readonly logger = new Logger(ProductGraphRepository.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async create(
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Product> {
    try {
      const productId = this.generateId();
      const now = new Date();

      const graphNode: ProductGraphNode = {
        id: productId,
        name: data.name,
        description: data.description || undefined,
        price: data.price,
        category: data.category || undefined,
        brand: data.brand || undefined,
        tags: data.tags || [],
        createdAt: now,
        updatedAt: now,
      };

      // The Neo4jService.createProductNode now handles category, brand, and tags internally
      // So we don't need to call these methods again here
      await this.neo4jService.createProductNode(graphNode);

      // ❌ REMOVE THESE DUPLICATE CALLS (now handled inside createProductNode):
      // if (data.category) {
      //   await this.neo4jService.createCategoryIfNotExists(data.category);
      //   await this.neo4jService.linkProductToCategory(productId, data.category);
      // }
      // if (data.brand) {
      //   await this.neo4jService.createBrandIfNotExists(data.brand);
      //   await this.neo4jService.linkProductToBrand(productId, data.brand);
      // }
      // if (data.tags && data.tags.length > 0) {
      //   await this.neo4jService.addProductTags(productId, data.tags);
      // }

      this.logger.log(`Product created in Neo4j with ID: ${productId}`);
      return this.mapGraphNodeToDomain({ ...graphNode, id: productId });
    } catch (error) {
      this.logger.error('Error creating product in Neo4j:', error);
      throw error;
    }
  }

  async findById(id: Product['id']): Promise<NullableType<Product>> {
    try {
      const graphNode = await this.neo4jService.findProductById(id);
      if (!graphNode) {
        return null;
      }
      return this.mapGraphNodeToDomain(graphNode);
    } catch (error) {
      this.logger.error(`Error finding product ${id} in Neo4j:`, error);
      throw error;
    }
  }

  async findByIds(ids: Product['id'][]): Promise<Product[]> {
    try {
      const products: Product[] = [];
      for (const id of ids) {
        const product = await this.findById(id);
        if (product) {
          products.push(product);
        }
      }
      return products;
    } catch (error) {
      this.logger.error('Error finding products by IDs in Neo4j:', error);
      throw error;
    }
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Product[]> {
    try {
      const query = `
        MATCH (p:Product)
        RETURN p
        ORDER BY p.createdAt DESC
        SKIP $skip
        LIMIT $limit
      `;

      const skip = (paginationOptions.page - 1) * paginationOptions.limit;
      const result = await this.neo4jService.runQuery(query, {
        skip,
        limit: paginationOptions.limit,
      });

      return result.map((record) =>
        this.mapGraphNodeToDomain(record.p.properties),
      );
    } catch (error) {
      this.logger.error(
        'Error finding products with pagination in Neo4j:',
        error,
      );
      throw error;
    }
  }

  async update(
    id: Product['id'],
    payload: Partial<Product>,
  ): Promise<NullableType<Product>> {
    try {
      const existingProduct = await this.findById(id);
      if (!existingProduct) {
        return null;
      }

      const updateData = {
        id,
        ...payload,
        updatedAt: new Date(),
        description: payload.description ?? undefined,
        category: payload.category ?? undefined,
        brand: payload.brand ?? undefined,
      };

      await this.neo4jService.updateProductNode(updateData);

      // Update relationships if category or brand changed
      if (payload.category) {
        await this.neo4jService.createCategoryIfNotExists(payload.category);
        // Remove old category relationship and create new one
        await this.neo4jService.runQuery(
          'MATCH (p:Product {id: $id})-[r:BELONGS_TO]->(:Category) DELETE r',
          { id },
        );
        await this.neo4jService.linkProductToCategory(id, payload.category);
      }

      if (payload.brand) {
        await this.neo4jService.createBrandIfNotExists(payload.brand);
        // Remove old brand relationship and create new one
        await this.neo4jService.runQuery(
          'MATCH (p:Product {id: $id})-[r:MADE_BY]->(:Brand) DELETE r',
          { id },
        );
        await this.neo4jService.linkProductToBrand(id, payload.brand);
      }

      if (payload.tags) {
        // Remove old tag relationships
        await this.neo4jService.runQuery(
          'MATCH (p:Product {id: $id})-[r:TAGGED_WITH]->(:Tag) DELETE r',
          { id },
        );
        // Add new tags
        await this.neo4jService.addProductTags(id, payload.tags);
      }

      this.logger.log(`Product updated in Neo4j with ID: ${id}`);
      return await this.findById(id);
    } catch (error) {
      this.logger.error(`Error updating product ${id} in Neo4j:`, error);
      throw error;
    }
  }

  async remove(id: Product['id']): Promise<void> {
    try {
      const deleted = await this.neo4jService.deleteProductNode(id);
      if (deleted) {
        this.logger.log(`Product deleted from Neo4j with ID: ${id}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting product ${id} from Neo4j:`, error);
      throw error;
    }
  }

  // Graph-specific methods
  async findSimilarProducts(
    productId: string,
    limit: number = 5,
  ): Promise<Product[]> {
    try {
      const graphNodes = await this.neo4jService.findSimilarProducts(
        productId,
        limit,
      );
      return graphNodes.map((node) => this.mapGraphNodeToDomain(node));
    } catch (error) {
      this.logger.error('Error finding similar products in Neo4j:', error);
      throw error;
    }
  }

  async findProductsByCategory(
    category: string,
    limit: number = 10,
  ): Promise<Product[]> {
    try {
      const graphNodes = await this.neo4jService.findProductsByCategory(
        category,
        limit,
      );
      return graphNodes.map((node) => this.mapGraphNodeToDomain(node));
    } catch (error) {
      this.logger.error('Error finding products by category in Neo4j:', error);
      throw error;
    }
  }

  async findFrequentlyBoughtTogether(
    productId: string,
    limit: number = 5,
  ): Promise<Product[]> {
    try {
      const graphNodes = await this.neo4jService.findFrequentlyBoughtTogether(
        productId,
        limit,
      );
      return graphNodes.map((node) => this.mapGraphNodeToDomain(node));
    } catch (error) {
      this.logger.error(
        'Error finding frequently bought together in Neo4j:',
        error,
      );
      throw error;
    }
  }

  async createProductRelationship(
    fromId: string,
    toId: string,
    type: string,
    properties?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.neo4jService.createProductRelationship({
        fromId,
        toId,
        type,
        properties,
      });
      this.logger.log(
        `Relationship ${type} created between ${fromId} and ${toId}`,
      );
    } catch (error) {
      this.logger.error('Error creating product relationship in Neo4j:', error);
      throw error;
    }
  }

  async getProductRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<Product[]> {
    try {
      const graphNodes = await this.neo4jService.getProductRecommendations(
        userId,
        limit,
      );
      return graphNodes.map((node) => this.mapGraphNodeToDomain(node));
    } catch (error) {
      this.logger.error(
        'Error getting product recommendations from Neo4j:',
        error,
      );
      throw error;
    }
  }

  async getPopularProducts(limit: number = 10): Promise<Product[]> {
    try {
      const graphNodes = await this.neo4jService.getPopularProducts(limit);
      return graphNodes.map((node) => this.mapGraphNodeToDomain(node));
    } catch (error) {
      this.logger.error('Error getting popular products from Neo4j:', error);
      throw error;
    }
  }

  private mapGraphNodeToDomain(graphNode: ProductGraphNode): Product {
    const product = new Product();

    product.id = graphNode.id;
    product.name = graphNode.name;
    product.description = graphNode.description || null;
    product.slug = this.generateSlug(graphNode.name);
    product.price = graphNode.price;

    // ✅ ADD THESE MISSING FIELD MAPPINGS:
    product.category = graphNode.category || null;
    product.brand = graphNode.brand || null;
    product.tags = graphNode.tags || [];

    // Set defaults for fields not stored in Neo4j
    product.costPrice = null;
    product.salePrice = null;
    product.stock = null;
    product.weight = null;
    product.dimensions = null;
    product.color = null;
    product.size = null;
    product.isActive = true;
    product.isFeatured = false;
    product.isDigital = false;
    product.metaTitle = null;
    product.metaDescription = null;
    product.publishedAt = null;
    product.expiresAt = null;
    product.createdAt = graphNode.createdAt;
    product.updatedAt = graphNode.updatedAt;

    return product;
  }

  private generateId(): string {
    return `product_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
