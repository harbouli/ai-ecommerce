import { NullableType } from '../../../utils/types/nullable.type';
import { KnowledgeEntity } from '../../domain/knowledge';

export abstract class KnowledgeRepository {
  abstract create(data: Omit<KnowledgeEntity, 'id'>): Promise<KnowledgeEntity>;
  abstract findById(
    id: KnowledgeEntity['id'],
  ): Promise<NullableType<KnowledgeEntity>>;
  abstract findByType(type: string): Promise<KnowledgeEntity[]>;
  abstract findByName(name: string): Promise<KnowledgeEntity[]>;
  abstract update(
    id: KnowledgeEntity['id'],
    payload: Partial<KnowledgeEntity>,
  ): Promise<KnowledgeEntity | null>;
  abstract remove(id: KnowledgeEntity['id']): Promise<void>;
  abstract findSimilar(
    vector: number[],
    limit: number,
  ): Promise<KnowledgeEntity[]>;
  abstract findByProperties(
    properties: Record<string, any>,
  ): Promise<KnowledgeEntity[]>;
}
