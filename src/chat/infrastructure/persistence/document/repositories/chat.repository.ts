import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat } from '../../../../domain/chat';
import { ChatRepository } from '../../chat.repository';
import { ChatSchemaClass } from '../entities/chat.schema';
import { ChatMapper } from '../mappers/chat.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class ChatDocumentRepository implements ChatRepository {
  constructor(
    @InjectModel(ChatSchemaClass.name)
    private readonly chatModel: Model<ChatSchemaClass>,
  ) {}

  async create(data: Omit<Chat, 'id'>): Promise<Chat> {
    const persistenceModel = ChatMapper.toPersistence(data as Chat);
    const createdChat = new this.chatModel(persistenceModel);
    const chatObject = await createdChat.save();
    return ChatMapper.toDomain(chatObject);
  }

  async findById(id: Chat['id']): Promise<NullableType<Chat>> {
    const chatObject = await this.chatModel.findById(id);
    return chatObject ? ChatMapper.toDomain(chatObject) : null;
  }

  async findByUserId(userId: string): Promise<Chat[]> {
    const chatObjects = await this.chatModel
      .find({ userId })
      .sort({ lastActivity: -1 });
    return chatObjects.map((chatObject) => ChatMapper.toDomain(chatObject));
  }

  async findBySessionId(sessionId: string): Promise<NullableType<Chat>> {
    const chatObject = await this.chatModel.findOne({ sessionId });
    return chatObject ? ChatMapper.toDomain(chatObject) : null;
  }

  async update(id: Chat['id'], payload: Partial<Chat>): Promise<Chat | null> {
    const clonedPayload = { ...payload };
    delete clonedPayload.id;
    delete clonedPayload.createdAt;
    delete clonedPayload.updatedAt;
    delete clonedPayload.deletedAt;

    const filter = { _id: id.toString() };
    const chat = await this.chatModel.findOne(filter);

    if (!chat) {
      return null;
    }

    const chatObject = await this.chatModel.findOneAndUpdate(
      filter,
      ChatMapper.toPersistence({
        ...ChatMapper.toDomain(chat),
        ...clonedPayload,
      }),
      { new: true },
    );

    return chatObject ? ChatMapper.toDomain(chatObject) : null;
  }

  async remove(id: Chat['id']): Promise<void> {
    await this.chatModel.deleteOne({ _id: id.toString() });
  }

  async findActiveByUserId(userId: string): Promise<Chat[]> {
    const chatObjects = await this.chatModel
      .find({ userId, status: 'ACTIVE' })
      .sort({ lastActivity: -1 });
    return chatObjects.map((chatObject) => ChatMapper.toDomain(chatObject));
  }

  async markAsCompleted(id: Chat['id']): Promise<Chat | null> {
    const chatObject = await this.chatModel.findOneAndUpdate(
      { _id: id.toString() },
      { status: 'COMPLETED', lastActivity: new Date() },
      { new: true },
    );

    return chatObject ? ChatMapper.toDomain(chatObject) : null;
  }

  async findWithPagination(options: IPaginationOptions): Promise<Chat[]> {
    const chatObjects = await this.chatModel
      .find()
      .sort({ lastActivity: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit);

    return chatObjects.map((chatObject) => ChatMapper.toDomain(chatObject));
  }

  async findByStatus(
    status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED',
  ): Promise<Chat[]> {
    const chatObjects = await this.chatModel
      .find({ status })
      .sort({ lastActivity: -1 });
    return chatObjects.map((chatObject) => ChatMapper.toDomain(chatObject));
  }

  async findRecentByUserId(userId: string, limit: number): Promise<Chat[]> {
    const chatObjects = await this.chatModel
      .find({ userId })
      .sort({ lastActivity: -1 })
      .limit(limit);
    return chatObjects.map((chatObject) => ChatMapper.toDomain(chatObject));
  }

  async countByUserId(userId: string): Promise<number> {
    return await this.chatModel.countDocuments({ userId });
  }

  async findByUserIdAndStatus(
    userId: string,
    status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED',
  ): Promise<Chat[]> {
    const chatObjects = await this.chatModel
      .find({ userId, status })
      .sort({ lastActivity: -1 });
    return chatObjects.map((chatObject) => ChatMapper.toDomain(chatObject));
  }

  async updateLastActivity(id: Chat['id']): Promise<Chat | null> {
    const chatObject = await this.chatModel.findOneAndUpdate(
      { _id: id.toString() },
      { lastActivity: new Date() },
      { new: true },
    );

    return chatObject ? ChatMapper.toDomain(chatObject) : null;
  }

  async findInactiveChats(inactiveThreshold: Date): Promise<Chat[]> {
    const chatObjects = await this.chatModel
      .find({
        status: 'ACTIVE',
        lastActivity: { $lt: inactiveThreshold },
      })
      .sort({ lastActivity: -1 });
    return chatObjects.map((chatObject) => ChatMapper.toDomain(chatObject));
  }

  // Additional helper methods specific to MongoDB
  async findByMetadata(metadata: Record<string, any>): Promise<Chat[]> {
    const chatObjects = await this.chatModel
      .find({ metadata })
      .sort({ lastActivity: -1 });
    return chatObjects.map((chatObject) => ChatMapper.toDomain(chatObject));
  }

  async aggregateByStatus(): Promise<{ _id: string; count: number }[]> {
    return await this.chatModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async findChatsByDateRange(startDate: Date, endDate: Date): Promise<Chat[]> {
    const chatObjects = await this.chatModel
      .find({
        createdAt: { $gte: startDate, $lte: endDate },
      })
      .sort({ createdAt: -1 });
    return chatObjects.map((chatObject) => ChatMapper.toDomain(chatObject));
  }
}
