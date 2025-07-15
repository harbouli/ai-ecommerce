import { Types } from 'mongoose';
import { AiSessionDocument } from '../entities/ai-session.schema';
import { AiSession } from '../../../../domain/ai-session';
import { AiInteraction } from '../../../../domain/ai-interaction';

export class AiSessionMapper {
  static toDomain(document: AiSessionDocument): AiSession {
    const interactions =
      document.interactions?.map(
        (interaction) =>
          new AiInteraction({
            id: interaction._id.toString(),
            sessionId: document._id.toString(),
            userId: document.userId,
            interactionType: interaction.interactionType,
            input: interaction.input,
            output: interaction.output,
            metadata: interaction.metadata,
            createdAt: interaction.createdAt,
          }),
      ) || [];

    return new AiSession({
      id: document._id.toString(),
      title: document.title,
      userId: document.userId,
      sessionType: document.sessionType,
      context: document.context,
      configuration: document.configuration,
      isActive: document.isActive,
      interactions,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      lastActivity: document.lastActivity,
    });
  }

  static toDocument(domain: AiSession): Partial<AiSessionDocument> {
    return {
      title: domain.title,
      userId: domain.userId,
      sessionType: domain.sessionType,
      context: domain.context,
      configuration: domain.configuration,
      isActive: domain.isActive,
      interactions:
        domain.interactions?.map((interaction) => ({
          _id: new Types.ObjectId(),
          interactionType: interaction.interactionType,
          input: interaction.input,
          output: interaction.output,
          metadata: interaction.metadata,
          createdAt: interaction.createdAt || new Date(),
        })) || [],
      lastActivity: domain.lastActivity,
    };
  }
}
