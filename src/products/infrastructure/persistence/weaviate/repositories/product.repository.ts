/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WeaviateService } from '../../../../../database/weaviate/weaviate.service';
import { ProductRepository } from '../../product.repository';
import { Product } from '../../../../domain/product';
import { ProductWeaviateMapper } from '../mappers/product.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { WeaviateClient } from 'weaviate-ts-client';
import axios from 'axios';

@Injectable()
export class ProductWeaviateRepository
  implements ProductRepository, OnModuleInit
{
  private readonly logger = new Logger(ProductWeaviateRepository.name);
  private readonly className = 'Product';
  private client: WeaviateClient;

  constructor(private readonly weaviateService: WeaviateService) {}

  async onModuleInit() {
    // Initialize the client when the module is ready
    this.client = await this.weaviateService.getClient();
    await this.initializeSchema();
  }

  private async initializeSchema(): Promise<void> {
    try {
      // Check if schema exists
      const schema = await this.client.schema.getter().do();
      const productClass = schema.classes?.find(
        (cls) => cls.class === this.className,
      );

      if (!productClass) {
        // Create schema if it doesn't exist
        await this.createProductSchema();
        this.logger.log(`Product schema created successfully in Weaviate`);
      }
    } catch (error) {
      this.logger.error('Error initializing Weaviate schema:', error);
    }
  }

  private async createProductSchema(): Promise<void> {
    const classDefinition = {
      class: this.className,
      description: 'Product information for e-commerce',
      vectorizer: 'none', // 🔥 CHANGED: Use 'none' to allow custom embeddings
      vectorIndexConfig: {
        distance: 'cosine', // Better for normalized embeddings
      },
      properties: [
        {
          name: 'name',
          dataType: ['text'],
          description: 'Product name',
        },
        {
          name: 'description',
          dataType: ['text'],
          description: 'Product description',
        },
        {
          name: 'slug',
          dataType: ['text'],
          description: 'Product URL slug',
        },
        {
          name: 'price',
          dataType: ['number'],
          description: 'Product price',
        },
        {
          name: 'costPrice',
          dataType: ['number'],
          description: 'Product cost price',
        },
        {
          name: 'salePrice',
          dataType: ['number'],
          description: 'Product sale price',
        },
        {
          name: 'stock',
          dataType: ['int'],
          description: 'Product stock quantity',
        },
        {
          name: 'weight',
          dataType: ['number'],
          description: 'Product weight',
        },
        {
          name: 'dimensions',
          dataType: ['text'],
          description: 'Product dimensions',
        },
        {
          name: 'color',
          dataType: ['text'],
          description: 'Product color',
        },
        {
          name: 'size',
          dataType: ['text'],
          description: 'Product size',
        },
        {
          name: 'isActive',
          dataType: ['boolean'],
          description: 'Product active status',
        },
        {
          name: 'isFeatured',
          dataType: ['boolean'],
          description: 'Product featured status',
        },
        {
          name: 'isDigital',
          dataType: ['boolean'],
          description: 'Product digital type',
        },
        {
          name: 'metaTitle',
          dataType: ['text'],
          description: 'Product meta title',
        },
        {
          name: 'metaDescription',
          dataType: ['text'],
          description: 'Product meta description',
        },
        {
          name: 'publishedAt',
          dataType: ['date'],
          description: 'Product publish date',
        },
        {
          name: 'expiresAt',
          dataType: ['date'],
          description: 'Product expiry date',
        },
        {
          name: 'createdAt',
          dataType: ['date'],
          description: 'Product creation date',
        },
        {
          name: 'updatedAt',
          dataType: ['date'],
          description: 'Product last update date',
        },
      ],
    };

    await this.client.schema.classCreator().withClass(classDefinition).do();
  }

  // Helper method to ensure client is ready
  private async ensureClientReady(): Promise<void> {
    if (!this.client) {
      this.client = await this.weaviateService.getClient();
    }
  }

  async create(
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Product> {
    await this.ensureClientReady();

    try {
      const persistenceModel = ProductWeaviateMapper.toPersistence({
        ...data,
        id: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Product);

      // 🔥 GENERATE EMBEDDING FOR THE PRODUCT
      const vectorizedText = persistenceModel.vectorizedText || '';
      const embedding = await this.generateEmbedding(vectorizedText);

      // Prepare data for Weaviate
      const {
        vector,
        vectorizedText: _,
        id,
        ...weaviateProperties
      } = persistenceModel;

      const result = await this.client.data
        .creator()
        .withClassName(this.className)
        .withProperties(weaviateProperties)
        .withVector(embedding) // 🔥 ADD CUSTOM VECTOR
        .do();

      this.logger.log(`Product created in Weaviate with ID: ${result.id}`);

      // Retrieve the created object to return complete data
      const createdObject = await this.findById(result.id ?? '');
      return createdObject!;
    } catch (error) {
      this.logger.error('Error creating product in Weaviate:', error);
      throw error;
    }
  }
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!text || text.trim().length === 0) {
        // Return zero vector for empty text
        return new Array(768).fill(0);
      }

      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

      const response = await axios.post(`${ollamaUrl}/api/embeddings`, {
        model: 'nomic-embed-text:latest',
        prompt: text.trim(),
      });

      if (!response.data?.embedding) {
        throw new Error('No embedding returned from Ollama');
      }

      const embedding = response.data.embedding;

      // Validate embedding dimensions
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error(
          `Invalid embedding format: expected array, got ${typeof embedding}`,
        );
      }

      this.logger.debug(
        `Generated ${embedding.length}-dimensional embedding for text: "${text.substring(0, 50)}..."`,
      );
      return embedding;
    } catch (error) {
      this.logger.error('Error generating embedding for Weaviate:', error);
      // Return zero vector as fallback
      return new Array(768).fill(0);
    }
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Product[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id } name description slug price costPrice salePrice stock weight dimensions color size isActive isFeatured isDigital metaTitle metaDescription publishedAt expiresAt createdAt updatedAt',
        )
        .withLimit(paginationOptions.limit)
        .withOffset((paginationOptions.page - 1) * paginationOptions.limit)
        .do();

      const products = result.data?.Get?.[this.className] || [];
      return products.map((product: any) =>
        ProductWeaviateMapper.toDomain({
          ...product,
          id: product._additional.id,
        }),
      );
    } catch (error) {
      this.logger.error('Error finding products by IDs in Weaviate:', error);
      throw error;
    }
  }

  async findById(id: Product['id']): Promise<NullableType<Product>> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id } name description slug price costPrice salePrice stock weight dimensions color size isActive isFeatured isDigital metaTitle metaDescription publishedAt expiresAt createdAt updatedAt',
        )
        .withWhere({
          path: ['id'],
          operator: 'Equal',
          valueString: id,
        })
        .do();

      const products = result.data?.Get?.[this.className] || [];
      if (products.length === 0) {
        return null;
      }

      return ProductWeaviateMapper.toDomain({
        ...products[0],
        id: products[0]._additional.id,
      });
    } catch (error) {
      this.logger.error(`Error finding product ${id} in Weaviate:`, error);
      throw error;
    }
  }

  async findByIds(ids: Product['id'][]): Promise<Product[]> {
    await this.ensureClientReady();

    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id } name description slug price costPrice salePrice stock weight dimensions color size isActive isFeatured isDigital metaTitle metaDescription publishedAt expiresAt createdAt updatedAt',
        )
        .withWhere({
          operator: 'Or',
          operands: ids.map((id) => ({
            path: ['id'],
            operator: 'Equal',
            valueString: id,
          })),
        })
        .do();

      const products = result.data?.Get?.[this.className] || [];
      return products.map((product: any) =>
        ProductWeaviateMapper.toDomain({
          ...product,
          id: product._additional.id,
        }),
      );
    } catch (error) {
      this.logger.error('Error finding products by IDs in Weaviate:', error);
      throw error;
    }
  }

  async update(
    id: Product['id'],
    payload: Partial<Product>,
  ): Promise<Product | null> {
    await this.ensureClientReady();

    try {
      // Get existing object first
      const existingProduct = await this.findById(id);
      if (!existingProduct) {
        return null;
      }

      // Merge with updates
      const updatedData = {
        ...existingProduct,
        ...payload,
        updatedAt: new Date(),
      };
      const persistenceModel = ProductWeaviateMapper.toPersistence(updatedData);

      // 🔥 GENERATE NEW EMBEDDING
      const vectorizedText = persistenceModel.vectorizedText || '';
      const embedding = await this.generateEmbedding(vectorizedText);

      // Prepare data for Weaviate
      const {
        vector,
        vectorizedText: _,
        ...weaviateProperties
      } = persistenceModel;

      await this.client.data
        .updater()
        .withClassName(this.className)
        .withId(id)
        .withProperties(weaviateProperties)
        .withVector(embedding) // 🔥 UPDATE VECTOR TOO
        .do();

      this.logger.log(
        `Product updated in Weaviate: ${id} (${embedding.length}D vector)`,
      );

      // Return updated object
      return this.findById(id);
    } catch (error) {
      this.logger.error('Error updating product in Weaviate:', error);
      throw error;
    }
  }

  async remove(id: Product['id']): Promise<void> {
    await this.ensureClientReady();

    try {
      await this.client.data
        .deleter()
        .withClassName(this.className)
        .withId(id)
        .do();

      this.logger.log(`Product deleted from Weaviate with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Error deleting product ${id} from Weaviate:`, error);
      throw error;
    }
  }

  async semanticSearch(
    embedding: number[],
    limit: number = 10,
    threshold: number = 0.7,
  ): Promise<Product[]> {
    await this.ensureClientReady();

    try {
      // Validate embedding input
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error(
          `Invalid embedding: expected non-empty array, got ${typeof embedding}`,
        );
      }

      this.logger.log(
        `Performing vector search with embedding (${embedding.length} dimensions)`,
      );

      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id certainty distance } name description slug price costPrice salePrice stock weight dimensions color size isActive isFeatured isDigital metaTitle metaDescription publishedAt expiresAt createdAt updatedAt',
        )
        .withNearVector({
          vector: embedding,
          certainty: threshold,
        })
        .withLimit(limit)
        .do();

      const products = result.data?.Get?.[this.className] || [];

      this.logger.log(`Found ${products.length} products with vector search`);

      return products
        .filter((product: any) => product._additional.certainty >= threshold)
        .map((product: any) =>
          ProductWeaviateMapper.toDomain({
            ...product,
            id: product._additional.id,
          }),
        );
    } catch (error) {
      this.logger.error(
        'Error performing embedding-based semantic search:',
        error,
      );
      throw error;
    }
  }
}
