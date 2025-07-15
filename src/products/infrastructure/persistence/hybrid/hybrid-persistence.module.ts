import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WeaviateModule } from '../../../../database/weaviate/weaviate.module';

import { ProductRepository } from '../product.repository';
import { HybridProductRepository } from './hybrid-product.repository';
import { ProductDocumentRepository } from '../document/repositories/product.repository';
import { ProductWeaviateRepository } from '../weaviate/repositories/product.repository';

import {
  ProductSchema,
  ProductSchemaClass,
} from '../document/entities/product.schema';

@Module({
  imports: [
    // MongoDB setup
    MongooseModule.forFeature([
      { name: ProductSchemaClass.name, schema: ProductSchema },
    ]),
    // Weaviate setup
    WeaviateModule,
  ],
  providers: [
    // MongoDB repository
    ProductDocumentRepository,
    // Weaviate repository
    ProductWeaviateRepository,
    // Hybrid repository that uses both
    HybridProductRepository,
    {
      provide: ProductRepository,
      useClass: HybridProductRepository,
    },
  ],
  exports: [
    ProductRepository,
    ProductDocumentRepository,
    ProductWeaviateRepository,
    HybridProductRepository,
  ],
})
export class HybridProductPersistenceModule {}
