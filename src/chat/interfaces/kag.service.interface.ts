import { Product } from '../../products/domain/product';

export interface IKagService {
  buildKnowledgeGraph(products: Product[]): Promise<void>;
  findRelatedProducts(productId: string): Promise<any[]>;
  getProductRecommendations(productId: string): Promise<any[]>;
  updateProductRelationships(productId: string): Promise<void>;
}
