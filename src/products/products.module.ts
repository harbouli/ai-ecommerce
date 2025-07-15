import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { HybridProductPersistenceModule } from './infrastructure/persistence/hybrid/hybrid-persistence.module';

@Module({
  imports: [HybridProductPersistenceModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
