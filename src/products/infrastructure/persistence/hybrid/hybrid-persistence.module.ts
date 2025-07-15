import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WeaviateModule } from '../../../../database/weaviate/weaviate.module';
import { Neo4jModule } from '../../../../database/neo4j/neo4j.module';

import { ProductRepository } from '../product.repository';
import { HybridProductRepository } from './hybrid-product.repository';
import { ProductDocumentRepository } from '../document/repositories/product.repository';
import { ProductWeaviateRepository } from '../weaviate/repositories/product.repository';
import { ProductGraphRepository } from '../graph/repositories/product-graph.repository';

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
    // Neo4j setup
    Neo4jModule,
  ],
  providers: [
    // Individual repository implementations
    ProductDocumentRepository,
    ProductWeaviateRepository,
    ProductGraphRepository,

    // Hybrid repository that uses all three databases
    {
      provide: ProductRepository,
      useClass: HybridProductRepository,
    },
  ],
  exports: [
    ProductRepository,
    ProductDocumentRepository,
    ProductWeaviateRepository,
    ProductGraphRepository,
  ],
})
export class HybridProductPersistenceModule {}
