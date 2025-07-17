import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { AllConfigType } from '../../config/config.type';

export interface ProductGraphNode {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  brand?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductRelationship {
  fromId: string;
  toId: string;
  type: string;
  properties?: Record<string, any>;
}

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private driver: Driver;

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  async onModuleInit(): Promise<void> {
    try {
      const uri =
        this.configService.get('app.neo4j.uri', { infer: true }) ||
        'bolt://localhost:7687';
      const username =
        this.configService.get('app.neo4j.username', { infer: true }) ||
        'neo4j';
      const password =
        this.configService.get('app.neo4j.password', { infer: true }) ||
        'password';

      this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

      await this.verifyConnectivity();
      await this.createConstraints();
      await this.createIndexes();
      this.logger.log('Neo4j connection established successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Neo4j:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver?.close();
    this.logger.log('Neo4j connection closed');
  }

  private async verifyConnectivity(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run('RETURN 1');
    } finally {
      await session.close();
    }
  }

  private async createConstraints(): Promise<void> {
    const session = this.driver.session();
    try {
      const constraints = [
        'CREATE CONSTRAINT IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (b:Brand) REQUIRE b.name IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
      ];

      for (const constraint of constraints) {
        await session.run(constraint);
      }
      this.logger.log('Neo4j constraints created successfully');
    } catch (error) {
      this.logger.error('Failed to create constraints:', error);
    } finally {
      await session.close();
    }
  }

  private async createIndexes(): Promise<void> {
    const session = this.driver.session();
    try {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS FOR (p:Product) ON (p.name)',
        'CREATE INDEX IF NOT EXISTS FOR (p:Product) ON (p.price)',
        'CREATE INDEX IF NOT EXISTS FOR (p:Product) ON (p.createdAt)',
        'CREATE INDEX IF NOT EXISTS FOR (c:Category) ON (c.name)',
        'CREATE INDEX IF NOT EXISTS FOR (b:Brand) ON (b.name)',
      ];

      for (const index of indexes) {
        await session.run(index);
      }
      this.logger.log('Neo4j indexes created successfully');
    } catch (error) {
      this.logger.error('Failed to create indexes:', error);
    } finally {
      await session.close();
    }
  }

  getSession(): Session {
    return this.driver.session();
  }

  async runQuery(
    query: string,
    parameters: Record<string, any> = {},
  ): Promise<any[]> {
    const session = this.getSession();
    try {
      const result = await session.run(query, parameters);
      return result.records.map((record) => record.toObject());
    } finally {
      await session.close();
    }
  }

  async createProductNode(
    product: ProductGraphNode,
  ): Promise<ProductGraphNode> {
    // Step 1: Create the product node WITHOUT category/brand properties
    // We'll create relationships separately to avoid parameter errors
    const query = `
    CREATE (p:Product {
      id: $id,
      name: $name,
      description: $description,
      price: $price,
      createdAt: datetime($createdAt),
      updatedAt: datetime($updatedAt)
    })
    RETURN p
  `;

    const parameters = {
      id: product.id,
      name: product.name,
      description: product.description || null,
      price: product.price,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };

    const result = await this.runQuery(query, parameters);

    // Step 2: Create Category node and relationship if category exists
    if (product.category) {
      await this.createCategoryIfNotExists(product.category);
      await this.linkProductToCategory(product.id, product.category);
    }

    // Step 3: Create Brand node and relationship if brand exists
    if (product.brand) {
      await this.createBrandIfNotExists(product.brand);
      await this.linkProductToBrand(product.id, product.brand);
    }

    // Step 4: Create Tag nodes and relationships if tags exist
    if (product.tags && product.tags.length > 0) {
      await this.addProductTags(product.id, product.tags);
    }

    return result[0]?.p.properties;
  }

  async updateProductNode(
    product: Partial<ProductGraphNode> & { id: string },
  ): Promise<ProductGraphNode> {
    const setClause = Object.keys(product)
      .filter((key) => key !== 'id')
      .map((key) => `p.${key} = $${key}`)
      .join(', ');

    const query = `
      MATCH (p:Product {id: $id})
      SET ${setClause}, p.updatedAt = datetime()
      RETURN p
    `;

    const result = await this.runQuery(query, product);
    return result[0]?.p.properties;
  }

  async findProductById(id: string): Promise<ProductGraphNode | null> {
    const query = `
      MATCH (p:Product {id: $id})
      RETURN p
    `;

    const result = await this.runQuery(query, { id });
    return result[0]?.p.properties || null;
  }

  async deleteProductNode(id: string): Promise<boolean> {
    const query = `
      MATCH (p:Product {id: $id})
      DETACH DELETE p
      RETURN count(p) as deletedCount
    `;

    const result = await this.runQuery(query, { id });
    return result[0]?.deletedCount > 0;
  }

  // Relationship methods
  async createProductRelationship(
    relationship: ProductRelationship,
  ): Promise<void> {
    const query = `
      MATCH (from:Product {id: $fromId})
      MATCH (to:Product {id: $toId})
      CREATE (from)-[r:${relationship.type}]->(to)
      SET r += $properties
      RETURN r
    `;

    await this.runQuery(query, {
      fromId: relationship.fromId,
      toId: relationship.toId,
      properties: relationship.properties || {},
    });
  }

  async findSimilarProducts(
    productId: string,
    limit: number = 5,
  ): Promise<ProductGraphNode[]> {
    const query = `
      MATCH (p:Product {id: $productId})-[:SIMILAR_TO|RELATED_TO|FREQUENTLY_BOUGHT_WITH]-(similar:Product)
      RETURN similar
      ORDER BY similar.price
      LIMIT $limit
    `;

    const result = await this.runQuery(query, { productId, limit });
    return result.map((record) => record.similar.properties);
  }

  async findProductsByCategory(
    category: string,
    limit: number = 10,
  ): Promise<ProductGraphNode[]> {
    const query = `
      MATCH (p:Product {category: $category})
      RETURN p
      ORDER BY p.createdAt DESC
      LIMIT $limit
    `;

    const result = await this.runQuery(query, { category, limit });
    return result.map((record) => record.p.properties);
  }

  async findFrequentlyBoughtTogether(
    productId: string,
    limit: number = 5,
  ): Promise<ProductGraphNode[]> {
    const query = `
      MATCH (p:Product {id: $productId})-[:FREQUENTLY_BOUGHT_WITH]-(related:Product)
      RETURN related, count(*) as frequency
      ORDER BY frequency DESC
      LIMIT $limit
    `;

    const result = await this.runQuery(query, { productId, limit });
    return result.map((record) => record.related.properties);
  }

  async createCategoryIfNotExists(categoryName: string): Promise<void> {
    const query = `
    MERGE (c:Category {name: $categoryName})
    RETURN c
  `;

    await this.runQuery(query, { categoryName });
  }
  async linkProductToCategory(
    productId: string,
    categoryName: string,
  ): Promise<void> {
    const query = `
    MATCH (p:Product {id: $productId})
    MATCH (c:Category {name: $categoryName})
    MERGE (p)-[:BELONGS_TO]->(c)
    RETURN p, c
  `;

    await this.runQuery(query, { productId, categoryName });
  }

  async createBrandIfNotExists(brandName: string): Promise<void> {
    const query = `
      MERGE (b:Brand {name: $brandName})
      RETURN b
    `;

    await this.runQuery(query, { brandName });
  }

  async linkProductToBrand(
    productId: string,
    brandName: string,
  ): Promise<void> {
    const query = `
    MATCH (p:Product {id: $productId})
    MATCH (b:Brand {name: $brandName})
    MERGE (p)-[:MADE_BY]->(b)
    RETURN p, b
  `;

    await this.runQuery(query, { productId, brandName });
  }

  async addProductTags(productId: string, tags: string[]): Promise<void> {
    if (!tags || tags.length === 0) return;

    for (const tagName of tags) {
      const query = `
      MATCH (p:Product {id: $productId})
      MERGE (t:Tag {name: $tagName})
      MERGE (p)-[:TAGGED_WITH]->(t)
      RETURN p, t
    `;

      await this.runQuery(query, { productId, tagName });
    }
  }

  // Analytics and recommendations
  async getProductRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<ProductGraphNode[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:PURCHASED|VIEWED]->(p:Product)
      MATCH (p)-[:SIMILAR_TO|FREQUENTLY_BOUGHT_WITH]-(recommended:Product)
      WHERE NOT (u)-[:PURCHASED]->(recommended)
      RETURN recommended, count(*) as score
      ORDER BY score DESC
      LIMIT $limit
    `;

    const result = await this.runQuery(query, { userId, limit });
    return result.map((record) => record.recommended.properties);
  }

  async getPopularProducts(limit: number = 10): Promise<ProductGraphNode[]> {
    const query = `
      MATCH (p:Product)<-[:PURCHASED|VIEWED]-(u:User)
      RETURN p, count(u) as popularity
      ORDER BY popularity DESC
      LIMIT $limit
    `;

    const result = await this.runQuery(query, { limit });
    return result.map((record) => record.p.properties);
  }
  async read(
    query: string,
    parameters: Record<string, any> = {},
  ): Promise<any> {
    const session = this.getSession();
    try {
      const result = await session.run(query, parameters);
      return result;
    } finally {
      await session.close();
    }
  }

  async write(
    query: string,
    parameters: Record<string, any> = {},
  ): Promise<any> {
    const session = this.getSession();
    try {
      const result = await session.writeTransaction((tx) =>
        tx.run(query, parameters),
      );
      return result;
    } finally {
      await session.close();
    }
  }
}
