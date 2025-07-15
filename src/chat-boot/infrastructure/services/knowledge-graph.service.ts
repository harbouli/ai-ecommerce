import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KnowledgeGraphRepository } from '../persistence/knowledge-graph.repository';
import { ProductRepository } from '../../../products/infrastructure/persistence/product.repository';
import { ProductNode } from '../../domain/knowledge-graph/nodes/product-node';
import { CategoryNode } from '../../domain/knowledge-graph/nodes/category-node';
import { CustomerProfileNode } from '../../domain/knowledge-graph/nodes/customer-profile-node';
import { BrandNode } from '../../domain/knowledge-graph/nodes/brand-node';
import { RelationshipFactory } from '../../domain/knowledge-graph/relationships/relationship-factory';
import { FeatureNode } from '../../domain/knowledge-graph/nodes/feature-node';

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);

  constructor(
    private readonly knowledgeGraphRepository: KnowledgeGraphRepository,
    private readonly productRepository: ProductRepository,
    private readonly mistralAiService: MistralAiService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  // Node Management
  async createProductNode(productData: any): Promise<ProductNode> {
    this.logger.log(`Creating product node: ${productData.id}`);

    const productNode = new ProductNode({
      name: productData.name,
      description: productData.description,
      price: productData.price,
      costPrice: productData.costPrice,
      salePrice: productData.salePrice,
      stock: productData.stock,
      weight: productData.weight,
      dimensions: productData.dimensions,
      color: productData.color,
      size: productData.size,
      isActive: productData.isActive,
      isFeatured: productData.isFeatured,
      isDigital: productData.isDigital,
      metaTitle: productData.metaTitle,
      metaDescription: productData.metaDescription,
      publishedAt: productData.publishedAt,
      expiresAt: productData.expiresAt,
    });

    const createdNode =
      await this.knowledgeGraphRepository.createNode(productNode);

    // Auto-generate features and relationships
    await this.generateProductFeatures(productNode);

    return createdNode as unknown as ProductNode;
  }

  async createCategoryNode(categoryData: any): Promise<CategoryNode> {
    this.logger.log(`Creating category node: ${categoryData.id}`);

    const categoryNode = new CategoryNode({
      id: categoryData.id,
      name: categoryData.name,
      description: categoryData.description,
      slug: categoryData.slug,
      parentId: categoryData.parentId,
      level: categoryData.level || 0,
      isActive: categoryData.isActive ?? true,
      sortOrder: categoryData.sortOrder || 0,
      metaTitle: categoryData.metaTitle,
      metaDescription: categoryData.metaDescription,
      imageUrl: categoryData.imageUrl,
    });

    const createdNode =
      await this.knowledgeGraphRepository.createNode(categoryNode);

    // Create hierarchy relationships
    if (categoryData.parentId) {
      await this.createCategoryHierarchy(
        categoryData.parentId,
        categoryData.id,
      );
    }

    return createdNode as CategoryNode;
  }

  async createCustomerProfileNode(
    customerData: any,
  ): Promise<CustomerProfileNode> {
    this.logger.log(`Creating customer profile node: ${customerData.id}`);

    const customerNode = new CustomerProfileNode({
      id: customerData.id,
      userId: customerData.userId,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      email: customerData.email,
      age: customerData.age,
      gender: customerData.gender,
      location: customerData.location,
      preferredLanguage: customerData.preferredLanguage,
      customerSegment: customerData.customerSegment || 'regular',
      lifetimeValue: customerData.lifetimeValue || 0,
      totalOrders: customerData.totalOrders || 0,
      averageOrderValue: customerData.averageOrderValue || 0,
      lastOrderDate: customerData.lastOrderDate,
      registrationDate: customerData.registrationDate || new Date(),
    });

    return (await this.knowledgeGraphRepository.createNode(
      customerNode,
    )) as CustomerProfileNode;
  }

  async createBrandNode(brandData: any): Promise<BrandNode> {
    this.logger.log(`Creating brand node: ${brandData.id}`);

    const brandNode = new BrandNode({
      id: brandData.id,
      name: brandData.name,
      description: brandData.description,
      logoUrl: brandData.logoUrl,
      website: brandData.website,
      countryOfOrigin: brandData.countryOfOrigin,
      foundedYear: brandData.foundedYear,
      isActive: brandData.isActive ?? true,
    });

    return (await this.knowledgeGraphRepository.createNode(
      brandNode,
    )) as BrandNode;
  }

  // Relationship Management
  async createProductCategoryRelationship(
    productId: string,
    categoryId: string,
    isPrimary: boolean = true,
  ): Promise<void> {
    this.logger.log(
      `Creating product-category relationship: ${productId} -> ${categoryId}`,
    );

    const relationship = RelationshipFactory.createProductCategoryRelationship(
      productId,
      categoryId,
      isPrimary,
    );

    await this.knowledgeGraphRepository.createRelationship(relationship);
  }

  async createCustomerPurchaseRelationship(
    customerId: string,
    productId: string,
    orderData: any,
  ): Promise<void> {
    this.logger.log(
      `Creating customer purchase relationship: ${customerId} -> ${productId}`,
    );

    const relationship = RelationshipFactory.createCustomerPurchaseRelationship(
      customerId,
      productId,
      orderData.purchaseDate,
      orderData.quantity,
      orderData.price,
    );

    await this.knowledgeGraphRepository.createRelationship(relationship);
  }

  async createCategoryHierarchy(
    parentCategoryId: string,
    childCategoryId: string,
  ): Promise<void> {
    this.logger.log(
      `Creating category hierarchy: ${parentCategoryId} -> ${childCategoryId}`,
    );

    const relationship =
      RelationshipFactory.createCategoryHierarchyRelationship(
        parentCategoryId,
        childCategoryId,
      );

    await this.knowledgeGraphRepository.createRelationship(relationship);
  }

  // AI-Enhanced Operations
  async generateProductFeatures(productNode: ProductNode): Promise<void> {
    this.logger.log(`Generating features for product: ${productNode.name}`);

    try {
      // Use AI to extract features from product description
      const featuresPrompt = `
        Analyze the following product and extract key features, specifications, and attributes:
        
        Product: ${productNode.name}
        Description: ${productNode.description}
        Price: ${productNode.price}
        Color: ${productNode.color}
        Size: ${productNode.size}
        Weight: ${productNode.weight}
        Dimensions: ${productNode.dimensions}
        
        Return a JSON array of features with the following structure:
        [
          {
            "name": "feature name",
            "value": "feature value",
            "type": "specification|benefit|attribute|tag",
            "unit": "unit if applicable"
          }
        ]
      `;

      const response = await this.mistralAiService.chat({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: featuresPrompt }],
        temperature: 0.3,
      });

      const features = JSON.parse(response.content);

      // Create feature nodes and relationships
      for (const featureData of features) {
        const featureNode = new FeatureNode({
          id: `feature_${productNode.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: featureData.name,
          featureType: featureData.type,
          value: featureData.value,
          unit: featureData.unit,
          isFilterable: true,
          displayOrder: 0,
        });

        await this.knowledgeGraphRepository.createNode(featureNode);

        const relationship =
          RelationshipFactory.createProductFeatureRelationship(
            productNode.id,
            featureNode.id,
            featureData.value,
            1.0,
          );

        await this.knowledgeGraphRepository.createRelationship(relationship);
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate features for product ${productNode.id}:`,
        error,
      );
    }
  }

  async calculateProductSimilarity(
    productId1: string,
    productId2: string,
  ): Promise<number> {
    this.logger.log(
      `Calculating similarity between products: ${productId1} and ${productId2}`,
    );

    try {
      // Get product embeddings
      const product1 = await this.knowledgeGraphRepository.findNodeById(
        'Product',
        productId1,
      );
      const product2 = await this.knowledgeGraphRepository.findNodeById(
        'Product',
        productId2,
      );

      if (!product1 || !product2) {
        throw new NotFoundException('One or both products not found');
      }

      // Create text representations for embedding
      const product1Text =
        `${product1.name} ${product1.description} ${product1.color} ${product1.size}`.trim();
      const product2Text =
        `${product2.name} ${product2.description} ${product2.color} ${product2.size}`.trim();

      // Generate embeddings
      const embeddings = await this.mistralAiService.embed({
        model: 'mistral-embed',
        input: [product1Text, product2Text],
      });

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(
        embeddings.embeddings[0],
        embeddings.embeddings[1],
      );

      // Create similarity relationship if high enough
      if (similarity > 0.7) {
        const reasons = await this.generateSimilarityReasons(
          product1,
          product2,
        );
        const relationship =
          RelationshipFactory.createProductSimilarityRelationship(
            productId1,
            productId2,
            similarity,
            reasons,
          );

        await this.knowledgeGraphRepository.createRelationship(relationship);
      }

      return similarity;
    } catch (error) {
      this.logger.error(
        `Failed to calculate similarity between ${productId1} and ${productId2}:`,
        error,
      );
      return 0;
    }
  }

  generateSimilarityReasons(product1: any, product2: any): Promise<string[]> {
    const reasons: string[] = [];

    if (product1.color && product2.color && product1.color === product2.color) {
      reasons.push('Same color');
    }

    if (product1.size && product2.size && product1.size === product2.size) {
      reasons.push('Same size');
    }

    if (Math.abs(product1.price - product2.price) < product1.price * 0.2) {
      reasons.push('Similar price range');
    }

    return reasons;
  }

  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Business Intelligence Operations
  async syncProductFromMongoDB(productId: string): Promise<void> {
    this.logger.log(`Syncing product from MongoDB: ${productId}`);

    try {
      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new NotFoundException(`Product ${productId} not found`);
      }

      // Check if node already exists
      const existingNode = await this.knowledgeGraphRepository.findNodeById(
        'Product',
        productId,
      );

      if (existingNode) {
        // Update existing node
        const productNode = new ProductNode({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          costPrice: product.costPrice,
          salePrice: product.salePrice,
          stock: product.stock,
          weight: product.weight,
          dimensions: product.dimensions,
          color: product.color,
          size: product.size,
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          isDigital: product.isDigital,
          metaTitle: product.metaTitle,
          metaDescription: product.metaDescription,
          publishedAt: product.publishedAt,
          expiresAt: product.expiresAt,
        });

        await this.knowledgeGraphRepository.updateNode(productNode);
      } else {
        // Create new node
        await this.createProductNode(product);
      }

      this.logger.log(`Product ${productId} synced successfully`);
    } catch (error) {
      this.logger.error(`Failed to sync product ${productId}:`, error);
      throw error;
    }
  }

  async generateCustomerInsights(customerId: string): Promise<any> {
    this.logger.log(`Generating insights for customer: ${customerId}`);

    try {
      const insights =
        await this.knowledgeGraphRepository.getCustomerInsights(customerId);

      if (!insights) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }

      // Enhance insights with AI analysis
      const enhancedInsights = await this.enhanceCustomerInsights(insights);

      return enhancedInsights;
    } catch (error) {
      this.logger.error(
        `Failed to generate customer insights for ${customerId}:`,
        error,
      );
      throw error;
    }
  }

  private async enhanceCustomerInsights(insights: any): Promise<any> {
    try {
      const analysisPrompt = `
        Analyze the following customer data and provide actionable insights:
        
        Customer: ${insights.customer.firstName} ${insights.customer.lastName}
        Segment: ${insights.customer.customerSegment}
        Lifetime Value: ${insights.customer.lifetimeValue}
        Total Orders: ${insights.customer.totalOrders}
        Average Order Value: ${insights.customer.averageOrderValue}
        
        Purchased Products: ${insights.purchasedProducts.map((p: any) => p.name).join(', ')}
        Preferred Categories: ${insights.preferredCategories.map((c: any) => c.name).join(', ')}
        Preferred Brands: ${insights.preferredBrands.map((b: any) => b.name).join(', ')}
        
        Provide insights in JSON format:
        {
          "customerPersona": "description of customer persona",
          "recommendations": ["recommendation 1", "recommendation 2", ...],
          "riskFactors": ["risk factor 1", "risk factor 2", ...],
          "opportunities": ["opportunity 1", "opportunity 2", ...],
          "nextBestActions": ["action 1", "action 2", ...]
        }
      `;

      const response = await this.mistralAiService.chat({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3,
      });

      const aiInsights = JSON.parse(response.content);

      return {
        ...insights,
        aiInsights,
      };
    } catch (error) {
      this.logger.error('Failed to enhance customer insights:', error);
      return insights;
    }
  }

  // Recommendation Engine
  async getPersonalizedRecommendations(
    customerId: string,
    limit: number = 10,
  ): Promise<any[]> {
    this.logger.log(
      `Getting personalized recommendations for customer: ${customerId}`,
    );

    try {
      const recommendations =
        await this.knowledgeGraphRepository.getCustomerRecommendations(
          customerId,
          limit,
        );

      // Enhance recommendations with explanations
      const enhancedRecommendations = await Promise.all(
        recommendations.map(async (rec) => {
          const explanation = await this.generateRecommendationExplanation(
            customerId,
            rec.product.id,
          );
          return {
            ...rec,
            explanation,
          };
        }),
      );

      return enhancedRecommendations;
    } catch (error) {
      this.logger.error(
        `Failed to get recommendations for customer ${customerId}:`,
        error,
      );
      return [];
    }
  }

  private async generateRecommendationExplanation(
    customerId: string,
    productId: string,
  ): Promise<string> {
    try {
      // Get customer's purchase history and preferences
      const customerInsights =
        await this.knowledgeGraphRepository.getCustomerInsights(customerId);
      const product = await this.knowledgeGraphRepository.findNodeById(
        'Product',
        productId,
      );

      if (!customerInsights || !product) {
        return 'Based on your interests';
      }

      const explanationPrompt = `
        Generate a brief explanation (max 50 words) for why this product is recommended:
        
        Product: ${product.name}
        Customer previously bought: ${customerInsights.purchasedProducts
          .slice(0, 3)
          .map((p: any) => p.name)
          .join(', ')}
        Customer prefers: ${customerInsights.preferredCategories
          .slice(0, 2)
          .map((c: any) => c.name)
          .join(', ')}
        
        Start with "Because you..." or "Since you..." and be specific about the connection.
      `;

      const response = await this.mistralAiService.chat({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: explanationPrompt }],
        temperature: 0.5,
        maxTokens: 100,
      });

      return response.content.trim();
    } catch (error) {
      this.logger.error(
        'Failed to generate recommendation explanation:',
        error,
      );
      return 'Based on your interests';
    }
  }

  // Analytics and Reporting
  async getProductAnalytics(productId: string): Promise<any> {
    this.logger.log(`Getting analytics for product: ${productId}`);

    try {
      const insights =
        await this.knowledgeGraphRepository.getProductInsights(productId);

      if (!insights) {
        throw new NotFoundException(`Product ${productId} not found`);
      }

      // Calculate analytics metrics
      const analytics = {
        product: insights.product,
        totalCustomers: insights.customers.length,
        categorization: insights.categories.map((c: any) => c.name),
        features: insights.features.map((f: any) => ({
          name: f.name,
          value: f.value,
          type: f.featureType,
        })),
        brandInfo: insights.brand,
        supplierInfo: insights.supplier,
        tags: insights.tags.map((t: any) => t.name),
        similarProducts: insights.similarProducts.length,
        relatedProducts: insights.relatedProducts.length,
        metrics: {
          purchaseFrequency: insights.customers.length,
          avgRating: 4.2, // Would calculate from reviews
          viewCount: 1250, // Would get from tracking
          conversionRate: 0.15, // Would calculate from analytics
        },
      };

      return analytics;
    } catch (error) {
      this.logger.error(
        `Failed to get analytics for product ${productId}:`,
        error,
      );
      throw error;
    }
  }

  async getCategoryAnalytics(categoryId: string): Promise<any> {
    this.logger.log(`Getting analytics for category: ${categoryId}`);

    try {
      const insights =
        await this.knowledgeGraphRepository.getCategoryInsights(categoryId);

      if (!insights) {
        throw new NotFoundException(`Category ${categoryId} not found`);
      }

      // Calculate category metrics
      const analytics = {
        category: insights.category,
        totalProducts: insights.products.length,
        activeProducts: insights.products.filter((p: any) => p.isActive).length,
        averagePrice:
          insights.products.reduce((sum: number, p: any) => sum + p.price, 0) /
          insights.products.length,
        priceRange: {
          min: Math.min(...insights.products.map((p: any) => p.price)),
          max: Math.max(...insights.products.map((p: any) => p.price)),
        },
        subcategories: insights.childCategories.map((c: any) => c.name),
        parentCategory: insights.parentCategory?.name,
        relatedCategories: insights.relatedCategories.map((c: any) => c.name),
        totalCustomers: insights.customers.length,
        commonFeatures: insights.commonFeatures.map((f: any) => f.name),
        performance: {
          totalSales: insights.products.reduce(
            (sum: number, p: any) => sum + (p.stock || 0),
            0,
          ),
          popularProducts: insights.products
            .filter((p: any) => p.isFeatured)
            .map((p: any) => p.name),
        },
      };

      return analytics;
    } catch (error) {
      this.logger.error(
        `Failed to get analytics for category ${categoryId}:`,
        error,
      );
      throw error;
    }
  }

  // Batch Operations
  async batchSyncProducts(limit: number = 100): Promise<void> {
    this.logger.log(`Starting batch sync of ${limit} products`);

    try {
      const products = await this.productRepository.findAllWithPagination({
        paginationOptions: { page: 1, limit },
      });

      for (const product of products) {
        try {
          await this.syncProductFromMongoDB(product.id);
        } catch (error) {
          this.logger.error(`Failed to sync product ${product.id}:`, error);
        }
      }

      this.logger.log(`Batch sync completed for ${products.length} products`);
    } catch (error) {
      this.logger.error('Failed to perform batch sync:', error);
      throw error;
    }
  }

  async buildProductSimilarityGraph(): Promise<void> {
    this.logger.log('Building product similarity graph');

    try {
      const products = await this.knowledgeGraphRepository.findNodesByType(
        'Product',
        { isActive: true },
      );

      for (let i = 0; i < products.length; i++) {
        for (let j = i + 1; j < products.length; j++) {
          try {
            await this.calculateProductSimilarity(
              products[i].id,
              products[j].id,
            );
          } catch (error) {
            this.logger.error(
              `Failed to calculate similarity between ${products[i].id} and ${products[j].id}:`,
              error,
            );
          }
        }
      }

      this.logger.log('Product similarity graph built successfully');
    } catch (error) {
      this.logger.error('Failed to build product similarity graph:', error);
      throw error;
    }
  }

  // Health and Monitoring
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    database: boolean;
    services: {
      neo4j: boolean;
      mistralAi: boolean;
      vectorStore: boolean;
    };
  }> {
    const [neo4jHealth, mistralAiHealth, vectorStoreHealth] = await Promise.all(
      [
        this.knowledgeGraphRepository.healthCheck(),
        this.checkMistralAiHealth(),
        this.vectorStoreService.healthCheck(),
      ],
    );

    const allHealthy = neo4jHealth && mistralAiHealth && vectorStoreHealth;

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: neo4jHealth,
      services: {
        neo4j: neo4jHealth,
        mistralAi: mistralAiHealth,
        vectorStore: vectorStoreHealth,
      },
    };
  }

  private async checkMistralAiHealth(): Promise<boolean> {
    try {
      await this.mistralAiService.chat({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: 'Health check' }],
        temperature: 0.1,
        maxTokens: 5,
      });
      return true;
    } catch (error) {
      this.logger.error('Mistral AI health check failed:', error);
      return false;
    }
  }

  async getGraphStats(): Promise<any> {
    this.logger.log('Getting knowledge graph statistics');

    try {
      const stats = await this.knowledgeGraphRepository.getDatabaseStats();

      // Get node counts by type
      const nodeCountsQuery = `
        CALL db.labels() YIELD label
        CALL apoc.cypher.run('MATCH (n:' + label + ') RETURN count(n) as count', {}) YIELD value
        RETURN label, value.count as count
      `;

      const relationshipCountsQuery = `
        CALL db.relationshipTypes() YIELD relationshipType
        CALL apoc.cypher.run('MATCH ()-[r:' + relationshipType + ']->() RETURN count(r) as count', {}) YIELD value
        RETURN relationshipType, value.count as count
      `;

      const [nodeCounts, relationshipCounts] = await Promise.all([
        this.knowledgeGraphRepository.runCypherQuery(nodeCountsQuery),
        this.knowledgeGraphRepository.runCypherQuery(relationshipCountsQuery),
      ]);

      return {
        database: stats,
        nodes: nodeCounts,
        relationships: relationshipCounts,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get graph stats:', error);
      return {
        database: {},
        nodes: [],
        relationships: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }
}
