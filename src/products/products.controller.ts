import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  HttpCode,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindAllProductsDto } from './dto/find-all-products.dto';
import { SemanticSearchDto } from './dto/semantic-search.dto';
import { SimilarProductsDto } from './dto/similar-products.dto';
import { HybridSearchDto } from './dto/hybrid-search.dto';
import { Product } from './domain/product';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new product',
    description:
      'Creates a product in MongoDB and automatically syncs to Weaviate for vector search capabilities',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product successfully created in both MongoDB and Weaviate.',
    type: Product,
  })
  create(@Body() createProductDto: CreateProductDto): Promise<Product> {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all products with pagination',
    description: 'Retrieves products from MongoDB with efficient pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products retrieved successfully from MongoDB.',
    type: [Product],
  })
  findAll(@Query() query: FindAllProductsDto): Promise<Product[]> {
    return this.productsService.findAllWithPagination({
      paginationOptions: {
        page: query.page ?? 1,
        limit: query.limit ?? 10,
      },
    });
  }

  @Get('search/semantic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI-powered semantic search',
    description:
      'Search products using natural language. Powered by Weaviate vector database for understanding context and meaning.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products found through AI-powered semantic search.',
    type: [Product],
  })
  async semanticSearch(
    @Query(new ValidationPipe({ transform: true })) query: SemanticSearchDto,
  ): Promise<Product[]> {
    return this.productsService.semanticSearch(
      query.q,
      query.limit,
      query.threshold,
    );
  }

  @Get('search/hybrid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hybrid search combining AI and traditional filters',
    description:
      'Combines semantic search from Weaviate with traditional filters from MongoDB',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products found through hybrid search.',
    type: [Product],
  })
  async hybridSearch(
    @Query(new ValidationPipe({ transform: true })) query: HybridSearchDto,
  ): Promise<Product[]> {
    return this.productsService.hybridSearch(
      query.q,
      {
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        category: query.category,
        isActive: query.isActive,
      },
      query.limit,
    );
  }

  @Get('featured')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get featured products',
    description: 'Retrieves featured products from MongoDB',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Featured products retrieved successfully.',
    type: [Product],
  })
  async findFeatured(@Query('limit') limit?: number): Promise<Product[]> {
    return this.productsService.findFeaturedProducts(limit);
  }

  @Get('category/:category')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get products by category',
    description: 'Retrieves products from a specific category using MongoDB',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products from category retrieved successfully.',
    type: [Product],
  })
  async findByCategory(
    @Param('category') category: string,
    @Query() query: FindAllProductsDto,
  ): Promise<Product[]> {
    return this.productsService.findByCategory(category, {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a product by ID',
    description: 'Retrieves a single product from MongoDB',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product retrieved successfully.',
    type: Product,
  })
  findOne(@Param('id') id: string): Promise<Product | null> {
    return this.productsService.findById(id);
  }

  @Get(':id/similar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Find similar products using AI',
    description:
      'Discovers similar products using Weaviate vector similarity, with data consistency from MongoDB',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Similar products found using AI analysis.',
    type: [Product],
  })
  async findSimilar(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) query: SimilarProductsDto,
  ): Promise<Product[]> {
    return this.productsService.findSimilarProducts(id, query.limit);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a product',
    description: 'Updates product in MongoDB and syncs changes to Weaviate',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product updated successfully in both databases.',
    type: Product,
  })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product | null> {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a product',
    description: 'Deletes product from MongoDB and removes from Weaviate',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Product deleted successfully from both databases.',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.productsService.remove(id);
  }
}
