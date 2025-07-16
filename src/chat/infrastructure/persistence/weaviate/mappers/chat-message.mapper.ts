import { Message } from '../../../../domain/message';
import { ChatMessageWeaviateSchema } from '../entities/chat-message.schema';

export class ChatMessageWeaviateMapper {
  public static toDomain(raw: ChatMessageWeaviateSchema): Message {
    const domainEntity = new Message();

    domainEntity.id = raw.id || '';
    domainEntity.chatId = raw.chatId;
    domainEntity.sessionId = raw.sessionId;
    domainEntity.type = raw.type;
    domainEntity.content = raw.content;
    domainEntity.intent = raw.intent;
    domainEntity.confidence = raw.confidence;
    domainEntity.timestamp = raw.timestamp;
    domainEntity.createdAt = raw.timestamp;
    domainEntity.updatedAt = raw.timestamp;

    // Reconstruct metadata
    if (raw.tokensUsed || raw.processingTime || raw.model || raw.userId) {
      domainEntity.metadata = {
        tokensUsed: raw.tokensUsed,
        processingTime: raw.processingTime,
        model: raw.model,
        userId: raw.userId,
      };
    }

    // Reconstruct entities
    if (raw.entityTexts && raw.entityTypes && raw.entityConfidences) {
      domainEntity.entities = raw.entityTexts.map((text, index) => ({
        text,
        type: raw.entityTypes![index] as any,
        confidence: raw.entityConfidences![index],
        metadata: {},
      }));
    }

    // Reconstruct context
    if (raw.contextSources && raw.contextContents && raw.contextScores) {
      domainEntity.context = raw.contextSources.map((source, index) => ({
        source: source as any,
        content: raw.contextContents![index],
        score: raw.contextScores![index],
        metadata: {},
      }));
    }

    return domainEntity;
  }

  public static toPersistence(
    domainEntity: Message,
  ): ChatMessageWeaviateSchema {
    const persistenceSchema = new ChatMessageWeaviateSchema();

    if (domainEntity.id) {
      persistenceSchema.id = domainEntity.id;
    }
    persistenceSchema.chatId = domainEntity.chatId;
    persistenceSchema.sessionId = domainEntity.sessionId;
    persistenceSchema.type = domainEntity.type;
    persistenceSchema.content = domainEntity.content;
    persistenceSchema.intent = domainEntity.intent;
    persistenceSchema.confidence = domainEntity.confidence;
    persistenceSchema.timestamp = domainEntity.timestamp;

    // Flatten metadata
    if (domainEntity.metadata) {
      persistenceSchema.tokensUsed = domainEntity.metadata.tokensUsed;
      persistenceSchema.processingTime = domainEntity.metadata.processingTime;
      persistenceSchema.model = domainEntity.metadata.model;
      persistenceSchema.userId = domainEntity.metadata.userId;
    }

    // Flatten entities
    if (domainEntity.entities && domainEntity.entities.length > 0) {
      persistenceSchema.entityTexts = domainEntity.entities.map((e) => e.text);
      persistenceSchema.entityTypes = domainEntity.entities.map((e) => e.type);
      persistenceSchema.entityConfidences = domainEntity.entities.map(
        (e) => e.confidence,
      );
    }

    // Flatten context
    if (domainEntity.context && domainEntity.context.length > 0) {
      persistenceSchema.contextSources = domainEntity.context.map(
        (c) => c.source,
      );
      persistenceSchema.contextContents = domainEntity.context.map(
        (c) => c.content,
      );
      persistenceSchema.contextScores = domainEntity.context.map(
        (c) => c.score,
      );
    }

    // Create vectorized text for semantic search
    const vectorizedParts = [
      domainEntity.content,
      domainEntity.intent,
      domainEntity.entities?.map((e) => e.text).join(' '),
      domainEntity.context?.map((c) => c.content).join(' '),
    ].filter(Boolean);

    persistenceSchema.vectorizedText = vectorizedParts.join(' ');

    return persistenceSchema;
  }
}
