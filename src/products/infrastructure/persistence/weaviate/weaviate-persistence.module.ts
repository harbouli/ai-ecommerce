import { Module } from '@nestjs/common';
import { WeaviateModule } from '../../../../database/weaviate/weaviate.module';
import { ProductRepository } from '../product.repository';
import { ProductWeaviateRepository } from './repositories/product.repository';

@Module({
  imports: [WeaviateModule],
  providers: [
    {
      provide: ProductRepository,
      useClass: ProductWeaviateRepository,
    },
  ],
  exports: [ProductRepository],
})
export class WeaviateProductPersistenceModule {}
