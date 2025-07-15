import {
  // common
  Injectable,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductRepository } from './infrastructure/persistence/product.repository';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { Product } from './domain/product';

@Injectable()
export class ProductsService {
  constructor(
    // Dependencies here
    private readonly productRepository: ProductRepository,
  ) {}

  async create(createProductDto: CreateProductDto) {
    // Do not remove comment below.
    // <creating-property />

    return this.productRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      expiresAt: createProductDto.expiresAt,

      publishedAt: createProductDto.publishedAt,

      metaDescription: createProductDto.metaDescription,

      metaTitle: createProductDto.metaTitle,

      isDigital: createProductDto.isDigital,

      isFeatured: createProductDto.isFeatured,

      isActive: createProductDto.isActive,

      size: createProductDto.size,

      color: createProductDto.color,

      dimensions: createProductDto.dimensions,

      weight: createProductDto.weight,

      stock: createProductDto.stock,

      salePrice: createProductDto.salePrice,

      costPrice: createProductDto.costPrice,

      price: createProductDto.price,

      description: createProductDto.description,

      name: createProductDto.name,
    });
  }

  findAllWithPagination({
    paginationOptions,
  }: {
    paginationOptions: IPaginationOptions;
  }) {
    return this.productRepository.findAllWithPagination({
      paginationOptions: {
        page: paginationOptions.page,
        limit: paginationOptions.limit,
      },
    });
  }

  findById(id: Product['id']) {
    return this.productRepository.findById(id);
  }

  findByIds(ids: Product['id'][]) {
    return this.productRepository.findByIds(ids);
  }

  async update(
    id: Product['id'],

    updateProductDto: UpdateProductDto,
  ) {
    // Do not remove comment below.
    // <updating-property />

    return this.productRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      expiresAt: updateProductDto.expiresAt,

      publishedAt: updateProductDto.publishedAt,

      metaDescription: updateProductDto.metaDescription,

      metaTitle: updateProductDto.metaTitle,

      isDigital: updateProductDto.isDigital,

      isFeatured: updateProductDto.isFeatured,

      isActive: updateProductDto.isActive,

      size: updateProductDto.size,

      color: updateProductDto.color,

      dimensions: updateProductDto.dimensions,

      weight: updateProductDto.weight,

      stock: updateProductDto.stock,

      salePrice: updateProductDto.salePrice,

      costPrice: updateProductDto.costPrice,

      price: updateProductDto.price,

      description: updateProductDto.description,

      name: updateProductDto.name,
    });
  }

  remove(id: Product['id']) {
    return this.productRepository.remove(id);
  }
}
