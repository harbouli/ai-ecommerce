/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { WeaviateService } from '../../../../../database/weaviate/weaviate.service';
import { ProductRepository } from '../../product.repository';
import { Product } from '../../../../domain/product';
import { ProductWeaviateMapper } from '../mappers/product.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';
import { WeaviateClient } from 'weaviate-ts-client';

@Injectable()
export class ProductWeaviateRepository implements ProductRepository {
  private readonly logger = new Logger(ProductWeaviateRepository.name);
  private readonly className = 'Product';
  private client: WeaviateClient;

  constructor(private readonly weaviateService: WeaviateService) {
    this.client = this.weaviateService.getClient();
    void this.initializeSchema();
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
      description: 'Product information for e-commerce platform',
      vectorizer: 'text2vec-transformers',
      moduleConfig: {
        'text2vec-transformers': {
          poolingStrategy: 'masked_mean',
          vectorizeClassName: false,
        },
      },
      properties: [
        {
          name: 'name',
          dataType: ['text'],
          description: 'Product name',
          moduleConfig: {
            'text2vec-transformers': {
              skip: false,
              vectorizePropertyName: false,
            },
          },
        },
        {
          name: 'description',
          dataType: ['text'],
          description: 'Product description',
          moduleConfig: {
            'text2vec-transformers': {
              skip: false,
              vectorizePropertyName: false,
            },
          },
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
          moduleConfig: {
            'text2vec-transformers': {
              skip: false,
              vectorizePropertyName: false,
            },
          },
        },
        {
          name: 'size',
          dataType: ['text'],
          description: 'Product size',
          moduleConfig: {
            'text2vec-transformers': {
              skip: false,
              vectorizePropertyName: false,
            },
          },
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
          description: 'Product digital status',
        },
        {
          name: 'metaTitle',
          dataType: ['text'],
          description: 'Product meta title',
          moduleConfig: {
            'text2vec-transformers': {
              skip: false,
              vectorizePropertyName: false,
            },
          },
        },
        {
          name: 'metaDescription',
          dataType: ['text'],
          description: 'Product meta description',
          moduleConfig: {
            'text2vec-transformers': {
              skip: false,
              vectorizePropertyName: false,
            },
          },
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

  async create(
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Product> {
    try {
      const persistenceModel = ProductWeaviateMapper.toPersistence({
        ...data,
        id: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Product);

      // Prepare data for Weaviate (exclude vector and vectorizedText from properties)
      const { vector, vectorizedText, id, ...weaviateProperties } =
        persistenceModel;

      const result = await this.client.data
        .creator()
        .withClassName(this.className)
        .withProperties(weaviateProperties)
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

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Product[]> {
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
      this.logger.error('Error finding products in Weaviate:', error);
      throw error;
    }
  }

  async findById(id: Product['id']): Promise<NullableType<Product>> {
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
          valueText: id,
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
      this.logger.error(
        `Error finding product by ID ${id} in Weaviate:`,
        error,
      );
      return null;
    }
  }

  async findByIds(ids: Product['id'][]): Promise<Product[]> {
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
            valueText: id,
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
  ): Promise<NullableType<Product>> {
    try {
      // First check if the object exists
      const existingProduct = await this.findById(id);
      if (!existingProduct) {
        return null;
      }

      // Update the object
      const updatedData = {
        ...existingProduct,
        ...payload,
        updatedAt: new Date(),
      };

      const persistenceModel = ProductWeaviateMapper.toPersistence(updatedData);
      const {
        vector,
        vectorizedText,
        id: entityId,
        ...weaviateProperties
      } = persistenceModel;

      await this.client.data
        .updater()
        .withId(id)
        .withClassName(this.className)
        .withProperties(weaviateProperties)
        .do();

      this.logger.log(`Product updated in Weaviate with ID: ${id}`);

      // Return the updated object
      return await this.findById(id);
    } catch (error) {
      this.logger.error(`Error updating product ${id} in Weaviate:`, error);
      throw error;
    }
  }

  async remove(id: Product['id']): Promise<void> {
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

  // Additional vector search methods
  async semanticSearch(
    query: string,
    limit: number = 10,
    threshold: number = 0.7,
  ): Promise<Product[]> {
    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id certainty } name description slug price costPrice salePrice stock weight dimensions color size isActive isFeatured isDigital metaTitle metaDescription publishedAt expiresAt createdAt updatedAt',
        )
        .withNearText({
          concepts: [query],
          certainty: threshold,
        })
        .withLimit(limit)
        .do();

      const products = result.data?.Get?.[this.className] || [];
      return products.map((product: any) =>
        ProductWeaviateMapper.toDomain({
          ...product,
          id: product._additional.id,
        }),
      );
    } catch (error) {
      this.logger.error('Error performing semantic search in Weaviate:', error);
      throw error;
    }
  }

  async findSimilarProducts(
    productId: string,
    limit: number = 5,
  ): Promise<Product[]> {
    try {
      const result = await this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(
          '_additional { id certainty } name description slug price costPrice salePrice stock weight dimensions color size isActive isFeatured isDigital metaTitle metaDescription publishedAt expiresAt createdAt updatedAt',
        )
        .withNearObject({
          id: productId,
        })
        .withLimit(limit + 1) // +1 to exclude the source product
        .do();

      const products = result.data?.Get?.[this.className] || [];
      return products
        .filter((product: any) => product._additional.id !== productId)
        .slice(0, limit)
        .map((product: any) =>
          ProductWeaviateMapper.toDomain({
            ...product,
            id: product._additional.id,
          }),
        );
    } catch (error) {
      this.logger.error('Error finding similar products in Weaviate:', error);
      throw error;
    }
  }
}
