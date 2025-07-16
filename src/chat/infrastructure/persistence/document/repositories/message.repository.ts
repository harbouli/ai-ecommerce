import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from '../../../../domain/message';
import { MessageRepository } from '../../message.repository';
import { MessageSchemaClass } from '../entities/message.schema';
import { MessageMapper } from '../mappers/message.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class MessageDocumentRepository implements MessageRepository {
  constructor(
    @InjectModel(MessageSchemaClass.name)
    private readonly messageModel: Model<MessageSchemaClass>,
  ) {}

  async create(data: Omit<Message, 'id'>): Promise<Message> {
    const persistenceModel = MessageMapper.toPersistence(data as Message);
    const createdMessage = new this.messageModel(persistenceModel);
    const messageObject = await createdMessage.save();
    return MessageMapper.toDomain(messageObject);
  }

  async findById(id: Message['id']): Promise<NullableType<Message>> {
    const messageObject = await this.messageModel.findById(id);
    return messageObject ? MessageMapper.toDomain(messageObject) : null;
  }

  async findByChatId(chatId: string): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ chatId })
      .sort({ timestamp: 1 }); // Ascending for conversation order
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async findBySessionId(sessionId: string): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ sessionId })
      .sort({ timestamp: 1 });
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async update(
    id: Message['id'],
    payload: Partial<Message>,
  ): Promise<Message | null> {
    const clonedPayload = { ...payload };
    delete clonedPayload.id;
    delete clonedPayload.createdAt;
    delete clonedPayload.updatedAt;
    delete clonedPayload.deletedAt;

    const filter = { _id: id.toString() };
    const message = await this.messageModel.findOne(filter);

    if (!message) {
      return null;
    }

    const messageObject = await this.messageModel.findOneAndUpdate(
      filter,
      MessageMapper.toPersistence({
        ...MessageMapper.toDomain(message),
        ...clonedPayload,
      }),
      { new: true },
    );

    return messageObject ? MessageMapper.toDomain(messageObject) : null;
  }

  async remove(id: Message['id']): Promise<void> {
    await this.messageModel.deleteOne({ _id: id.toString() });
  }

  async findRecentByUserId(userId: string, limit: number): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ 'metadata.userId': userId })
      .sort({ timestamp: -1 })
      .limit(limit);
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async findByEntityType(entityType: string): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ 'entities.type': entityType })
      .sort({ timestamp: -1 });
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async findByIntent(intent: string): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ intent })
      .sort({ timestamp: -1 });
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({
        timestamp: { $gte: startDate, $lte: endDate },
      })
      .sort({ timestamp: -1 });
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async aggregateByIntent(): Promise<any[]> {
    return await this.messageModel.aggregate([
      {
        $match: { intent: { $exists: true, $ne: null } },
      },
      {
        $group: {
          _id: '$intent',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$confidence' },
          lastUsed: { $max: '$timestamp' },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);
  }

  async findConversationHistory(
    sessionId: string,
    limit: number,
  ): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ sessionId })
      .sort({ timestamp: -1 })
      .limit(limit);
    return messageObjects
      .reverse() // Reverse to get chronological order
      .map((messageObject) => MessageMapper.toDomain(messageObject));
  }

  async findByType(type: 'USER' | 'ASSISTANT' | 'SYSTEM'): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ type })
      .sort({ timestamp: -1 });
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async findWithPagination(options: IPaginationOptions): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find()
      .sort({ timestamp: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit);
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async searchByContent(searchTerm: string): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ $text: { $search: searchTerm } })
      .sort({ score: { $meta: 'textScore' } });
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async findByContextSource(source: string): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ 'context.source': source })
      .sort({ timestamp: -1 });
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async countByChatId(chatId: string): Promise<number> {
    return await this.messageModel.countDocuments({ chatId });
  }

  // Additional MongoDB-specific methods
  async findMessagesWithHighConfidence(
    minConfidence: number,
  ): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ confidence: { $gte: minConfidence } })
      .sort({ confidence: -1 });
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async findMessagesByEntityText(entityText: string): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ 'entities.text': entityText })
      .sort({ timestamp: -1 });
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async aggregateEntityUsage(): Promise<any[]> {
    return await this.messageModel.aggregate([
      { $unwind: '$entities' },
      {
        $group: {
          _id: {
            type: '$entities.type',
            text: '$entities.text',
          },
          count: { $sum: 1 },
          avgConfidence: { $avg: '$entities.confidence' },
          lastUsed: { $max: '$timestamp' },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);
  }

  async findMessagesByTokenUsage(minTokens: number): Promise<Message[]> {
    const messageObjects = await this.messageModel
      .find({ 'metadata.tokensUsed': { $gte: minTokens } })
      .sort({ 'metadata.tokensUsed': -1 });
    return messageObjects.map((messageObject) =>
      MessageMapper.toDomain(messageObject),
    );
  }

  async aggregateMessageStats(): Promise<any> {
    return await this.messageModel.aggregate([
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          avgTokensUsed: { $avg: '$metadata.tokensUsed' },
          avgProcessingTime: { $avg: '$metadata.processingTime' },
          avgConfidence: { $avg: '$confidence' },
          userMessages: {
            $sum: { $cond: [{ $eq: ['$type', 'USER'] }, 1, 0] },
          },
          assistantMessages: {
            $sum: { $cond: [{ $eq: ['$type', 'ASSISTANT'] }, 1, 0] },
          },
          systemMessages: {
            $sum: { $cond: [{ $eq: ['$type', 'SYSTEM'] }, 1, 0] },
          },
        },
      },
    ]);
  }
}
