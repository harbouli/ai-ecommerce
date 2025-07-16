import { KnowledgeEntity } from '../../../../domain/knowledge';
import { KnowledgeSchemaClass } from '../entities/knowledge.schema';

export class KnowledgeMapper {
  static toDomain(raw: KnowledgeSchemaClass): KnowledgeEntity {
    const domainEntity = new KnowledgeEntity();
    domainEntity.id = raw._id.toString();
    domainEntity.type = raw.type;
    domainEntity.name = raw.name;
    domainEntity.description = raw.description;
    domainEntity.properties = raw.properties || {};
    domainEntity.vector = raw.vector;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: KnowledgeEntity): KnowledgeSchemaClass {
    const persistenceSchema = new KnowledgeSchemaClass();

    if (domainEntity.id && typeof domainEntity.id === 'string') {
      persistenceSchema._id = domainEntity.id;
    }

    persistenceSchema.type = domainEntity.type;
    persistenceSchema.name = domainEntity.name;
    persistenceSchema.description = domainEntity.description;
    persistenceSchema.properties = domainEntity.properties || {};
    persistenceSchema.vector = domainEntity.vector;
    persistenceSchema.createdAt = domainEntity.createdAt;
    persistenceSchema.updatedAt = domainEntity.updatedAt;

    return persistenceSchema;
  }
}
