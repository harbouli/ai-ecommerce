import { ConversationContext } from '../../../../domain/conversation';
import { ConversationContextWeaviateSchema } from '../entities/conversation-context.schema';

export class ConversationContextWeaviateMapper {
  public static toDomain(
    raw: ConversationContextWeaviateSchema,
  ): ConversationContext {
    const domainEntity = new ConversationContext();

    domainEntity.sessionId = raw.sessionId;
    domainEntity.userId = raw.userId;
    domainEntity.currentIntent = raw.contextType;
    domainEntity.extractedEntities = [];
    domainEntity.conversationHistory = [];
    domainEntity.recommendations = [];
    domainEntity.summary = raw.content;
    domainEntity.createdAt = raw.timestamp;
    domainEntity.updatedAt = raw.timestamp;

    return domainEntity;
  }

  public static toPersistence(
    domainEntity: ConversationContext,
  ): ConversationContextWeaviateSchema {
    const persistenceSchema = new ConversationContextWeaviateSchema();

    persistenceSchema.sessionId = domainEntity.sessionId;
    persistenceSchema.userId = domainEntity.userId;
    persistenceSchema.contextType = 'SUMMARY';
    persistenceSchema.content =
      domainEntity.summary || JSON.stringify(domainEntity.userProfile);
    persistenceSchema.timestamp = domainEntity.updatedAt || new Date();
    persistenceSchema.vectorizedText =
      domainEntity.summary || JSON.stringify(domainEntity.userProfile);

    return persistenceSchema;
  }
}
