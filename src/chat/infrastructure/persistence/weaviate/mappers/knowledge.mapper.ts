import { KnowledgeEntity } from '../../../../domain/knowledge';
import { KnowledgeWeaviateSchema } from '../entities/knowledge.schema';

export class KnowledgeWeaviateMapper {
  public static toDomain(raw: KnowledgeWeaviateSchema): KnowledgeEntity {
    const domainEntity = new KnowledgeEntity();

    domainEntity.id = raw.id || '';
    domainEntity.type = raw.type;
    domainEntity.name = raw.name;
    domainEntity.description = raw.description;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;

    // Reconstruct properties from flattened arrays
    if (raw.propertyKeys && raw.propertyValues) {
      domainEntity.properties = {};
      raw.propertyKeys.forEach((key, index) => {
        if (raw.propertyValues && raw.propertyValues[index]) {
          try {
            domainEntity.properties[key] = JSON.parse(
              raw.propertyValues[index],
            );
          } catch {
            domainEntity.properties[key] = raw.propertyValues[index];
          }
        }
      });
    } else {
      domainEntity.properties = raw.properties || {};
    }

    // Set vector if available
    if (raw.vector) {
      domainEntity.vector = raw.vector;
    }

    return domainEntity;
  }

  public static toPersistence(
    domainEntity: KnowledgeEntity,
  ): KnowledgeWeaviateSchema {
    const persistenceSchema = new KnowledgeWeaviateSchema();

    if (domainEntity.id) {
      persistenceSchema.id = domainEntity.id;
    }
    persistenceSchema.type = domainEntity.type;
    persistenceSchema.name = domainEntity.name;
    persistenceSchema.description = domainEntity.description;
    persistenceSchema.createdAt = domainEntity.createdAt || new Date();
    persistenceSchema.updatedAt = domainEntity.updatedAt || new Date();

    // Flatten properties for Weaviate
    if (domainEntity.properties) {
      persistenceSchema.propertyKeys = Object.keys(domainEntity.properties);
      persistenceSchema.propertyValues = Object.values(
        domainEntity.properties,
      ).map((value) =>
        typeof value === 'string' ? value : JSON.stringify(value),
      );
      persistenceSchema.properties = domainEntity.properties;
    }

    // Set vector if available
    if (domainEntity.vector) {
      persistenceSchema.vector = domainEntity.vector;
    }

    // Create vectorized text for semantic search
    const vectorizedParts = [
      domainEntity.name,
      domainEntity.description,
      domainEntity.type,
      Object.values(domainEntity.properties || {}).join(' '),
    ].filter(Boolean);

    persistenceSchema.vectorizedText = vectorizedParts.join(' ');

    return persistenceSchema;
  }
}
