import { NullableType } from '../../../utils/types/nullable.type';
import { KnowledgeEntity } from '../../domain/knowledge';

export abstract class KnowledgeRepository {
  // Basic CRUD operations
  abstract create(data: Omit<KnowledgeEntity, 'id'>): Promise<KnowledgeEntity>;
  abstract findById(
    id: KnowledgeEntity['id'],
  ): Promise<NullableType<KnowledgeEntity>>;
  abstract update(
    id: KnowledgeEntity['id'],
    payload: Partial<KnowledgeEntity>,
  ): Promise<KnowledgeEntity | null>;
  abstract remove(id: KnowledgeEntity['id']): Promise<void>;

  // Shopping-focused queries
  abstract findByType(
    type: KnowledgeEntity['type'],
  ): Promise<KnowledgeEntity[]>;
  abstract findByName(name: string): Promise<KnowledgeEntity[]>;
  abstract findByCategory(category: string): Promise<KnowledgeEntity[]>;
  abstract findByBrand(brand: string): Promise<KnowledgeEntity[]>;
  abstract findByProperties(
    properties: Record<string, any>,
  ): Promise<KnowledgeEntity[]>;

  // RAG operations - semantic search
  abstract findSimilar(
    vector: number[],
    limit?: number,
  ): Promise<KnowledgeEntity[]>;
  abstract semanticSearch(
    query: string,
    limit?: number,
  ): Promise<KnowledgeEntity[]>;

  // KAG operations - graph relationships
  abstract findRelated(
    entityId: string,
    hops?: number,
  ): Promise<KnowledgeEntity[]>;
  abstract findRecommendations(
    entityId: string,
    limit?: number,
  ): Promise<KnowledgeEntity[]>;

  // Hybrid search combining RAG + KAG
  abstract hybridSearch(
    query: string,
    filters?: Record<string, any>,
  ): Promise<KnowledgeEntity[]>;
}
