// src/chat/infrastructure/persistence/document/mappers/knowledge.mapper.ts
import { KnowledgeEntity } from '../../../../domain/knowledge';
import { KnowledgeSchemaClass } from '../entities/knowledge.schema';

export class KnowledgeMapper {
  static toDomain(raw: KnowledgeSchemaClass): KnowledgeEntity {
    const domainEntity = new KnowledgeEntity();
    domainEntity.id = raw._id?.toString() || '';
    domainEntity.type = raw.type;
    domainEntity.name = raw.name;
    domainEntity.description = raw.description;
    domainEntity.properties = raw.properties || {};
    domainEntity.vector = raw.vector;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(
    domainEntity: KnowledgeEntity,
  ): Partial<KnowledgeSchemaClass> {
    const persistenceSchema: Partial<KnowledgeSchemaClass> = {
      type: domainEntity.type,
      name: domainEntity.name,
      description: domainEntity.description,
      properties: domainEntity.properties || {},
      vector: domainEntity.vector,
      createdAt: domainEntity.createdAt,
      updatedAt: domainEntity.updatedAt,
    };

    // Only set _id if domainEntity.id is provided and not empty
    if (domainEntity.id && domainEntity.id !== '') {
      (persistenceSchema as any)._id = domainEntity.id;
    }

    return persistenceSchema;
  }

  static toCreatePersistence(
    data: Omit<KnowledgeEntity, 'id'>,
  ): Partial<KnowledgeSchemaClass> {
    return {
      type: data.type,
      name: data.name,
      description: data.description,
      properties: data.properties || {},
      vector: data.vector,
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date(),
    };
  }
}
