import { Module } from '@nestjs/common';
import { Neo4jModule } from '../../../../database/neo4j/neo4j.module';
import { ProductRepository } from '../product.repository';
import { ProductGraphRepository } from './repositories/product-graph.repository';

@Module({
  imports: [Neo4jModule],
  providers: [
    {
      provide: ProductRepository,
      useClass: ProductGraphRepository,
    },
  ],
  exports: [ProductRepository],
})
export class GraphProductPersistenceModule {}
