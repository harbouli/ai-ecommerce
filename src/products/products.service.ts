import { Injectable, Logger } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductRepository } from './infrastructure/persistence/product.repository';
import { HybridProductRepository } from './infrastructure/persistence/hybrid/hybrid-product.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Product } from './domain/product';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly productRepository: ProductRepository,
    private readonly hybridRepository: HybridProductRepository,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    this.logger.log(`Creating product: ${createProductDto.name}`);

    return this.productRepository.create({
      name: createProductDto.name,
      description: createProductDto.description,
      slug: createProductDto.slug,
      price: createProductDto.price,
      costPrice: createProductDto.costPrice,
      salePrice: createProductDto.salePrice,
      stock: createProductDto.stock,
      weight: createProductDto.weight,
      dimensions: createProductDto.dimensions,
      color: createProductDto.color,
      size: createProductDto.size,
      isActive: createProductDto.isActive ?? true,
      isFeatured: createProductDto.isFeatured ?? false,
      isDigital: createProductDto.isDigital ?? false,
      metaTitle: createProductDto.metaTitle,
      metaDescription: createProductDto.metaDescription,
      publishedAt: createProductDto.publishedAt,
      expiresAt: createProductDto.expiresAt,
    });
  }

  async findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }): Promise<Product[]> {
    // Uses MongoDB for fast pagination
    return this.productRepository.findAllWithPagination({ paginationOptions });
  }

  async findById(id: Product['id']): Promise<Product | null> {
    // Uses MongoDB for fast individual lookups
    return this.productRepository.findById(id);
  }

  async findByIds(ids: Product['id'][]): Promise<Product[]> {
    // Uses MongoDB for efficient bulk lookups
    return this.productRepository.findByIds(ids);
  }

  async update(
    id: Product['id'],
    updateProductDto: UpdateProductDto,
  ): Promise<Product | null> {
    this.logger.log(`Updating product: ${id}`);
    return this.productRepository.update(id, updateProductDto);
  }

  async remove(id: Product['id']): Promise<void> {
    this.logger.log(`Deleting product: ${id}`);
    return this.productRepository.remove(id);
  }

  // AI-powered search methods using Weaviate
  async semanticSearch(
    query: string,
    limit: number = 10,
    threshold: number = 0.7,
  ): Promise<Product[]> {
    this.logger.log(`Semantic search for: "${query}"`);
    return this.hybridRepository.semanticSearch(query, limit, threshold);
  }

  async findSimilarProducts(
    productId: string,
    limit: number = 5,
  ): Promise<Product[]> {
    this.logger.log(`Finding similar products for: ${productId}`);
    return this.hybridRepository.findSimilarProducts(productId, limit);
  }

  async findByCategory(
    category: string,
    paginationOptions: IPaginationOptions,
  ): Promise<Product[]> {
    return this.hybridRepository.findByCategory(category, paginationOptions);
  }

  async findFeaturedProducts(limit: number = 10): Promise<Product[]> {
    return this.productRepository.findAllWithPagination({
      paginationOptions: { page: 1, limit },
    });
  }

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
    // 1. First, get semantic search results from Weaviate
    const vectorResults = await this.hybridRepository.semanticSearch(
      query,
      limit * 2,
      0.6,
    );

    // 2. Apply traditional filters (this would be implemented in MongoDB repository)
    let filteredResults = vectorResults;

    if (filters.minPrice !== undefined) {
      filteredResults = filteredResults.filter(
        (p) => p.price >= filters.minPrice!,
      );
    }

    if (filters.maxPrice !== undefined) {
      filteredResults = filteredResults.filter(
        (p) => p.price <= filters.maxPrice!,
      );
    }

    if (filters.isActive !== undefined) {
      filteredResults = filteredResults.filter(
        (p) => p.isActive === filters.isActive,
      );
    }

    return filteredResults.slice(0, limit);
  }
}
