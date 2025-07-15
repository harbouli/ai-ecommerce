import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ChatSessionDocument,
  ChatSessionSchema,
} from '../entities/chat-session.schema';
import { ChatSessionMapper } from '../mappers/chat-session.mapper';
import { ChatRepository } from '../../chat.repository';
import { ChatSession, Message } from '../../../../domain/chat-session';
import { PaginationOptions } from '../../../../chat-boot.service';

@Injectable()
export class ChatDocumentRepository implements ChatRepository {
  private readonly logger = new Logger(ChatDocumentRepository.name);

  constructor(
    @InjectModel(ChatSessionSchema.name)
    private readonly chatModel: Model<ChatSessionDocument>,
  ) {}

  async create(chatSession: ChatSession): Promise<ChatSession> {
    this.logger.log(
      `Creating new chat session for user: ${chatSession.userId}`,
    );

    const documentData = ChatSessionMapper.toDocument(chatSession);
    const document = new this.chatModel(documentData);
    const savedDocument = await document.save();

    return ChatSessionMapper.toDomain(savedDocument);
  }

  async findById(id: string): Promise<ChatSession | null> {
    this.logger.log(`Finding chat session by ID: ${id}`);

    try {
      const document = await this.chatModel
        .findById(new Types.ObjectId(id))
        .exec();

      return document ? ChatSessionMapper.toDomain(document) : null;
    } catch (error) {
      this.logger.error(`Error finding chat session ${id}:`, error);
      return null;
    }
  }

  async findByUserId(
    userId: string,
    paginationOptions: PaginationOptions,
  ): Promise<ChatSession[]> {
    this.logger.log(`Finding chat sessions for user: ${userId}`);

    const { page, limit } = paginationOptions;
    const skip = (page - 1) * limit;

    const documents = await this.chatModel
      .find({ userId })
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return documents.map((doc) => ChatSessionMapper.toDomain(doc));
  }

  async update(
    id: string,
    updateData: Partial<ChatSession>,
  ): Promise<ChatSession> {
    this.logger.log(`Updating chat session: ${id}`);

    const document = await this.chatModel
      .findByIdAndUpdate(
        new Types.ObjectId(id),
        { ...updateData, updatedAt: new Date() },
        { new: true },
      )
      .exec();

    if (!document) {
      throw new NotFoundException(`Chat session with ID ${id} not found`);
    }

    return ChatSessionMapper.toDomain(document)!;
  }

  async delete(id: string): Promise<void> {
    this.logger.log(`Deleting chat session: ${id}`);

    const result = await this.chatModel
      .findByIdAndDelete(new Types.ObjectId(id))
      .exec();

    if (!result) {
      throw new NotFoundException(`Chat session with ID ${id} not found`);
    }
  }

  async addMessage(message: Message): Promise<Message> {
    this.logger.log(`Adding message to chat: ${message.chatId}`);

    const messageData = {
      _id: new Types.ObjectId(),
      content: message.content,
      role: message.role,
      metadata: message.metadata,
      createdAt: new Date(),
    };

    const document = await this.chatModel
      .findByIdAndUpdate(
        new Types.ObjectId(message.chatId),
        {
          $push: { messages: messageData },
          $set: { lastActivity: new Date(), updatedAt: new Date() },
        },
        { new: true },
      )
      .exec();

    if (!document) {
      throw new NotFoundException(
        `Chat session with ID ${message.chatId} not found`,
      );
    }

    return new Message({
      id: messageData._id.toString(),
      chatId: message.chatId,
      content: message.content,
      role: message.role,
      metadata: message.metadata,
      createdAt: messageData.createdAt,
    });
  }

  async getMessages(
    chatId: string,
    paginationOptions: PaginationOptions,
  ): Promise<Message[]> {
    this.logger.log(`Getting messages for chat: ${chatId}`);

    const document = await this.chatModel
      .findById(new Types.ObjectId(chatId))
      .select('messages')
      .exec();

    if (!document) {
      throw new NotFoundException(`Chat session with ID ${chatId} not found`);
    }

    const { page, limit } = paginationOptions;
    const skip = (page - 1) * limit;

    const messages = document.messages
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) // Chronological order
      .slice(skip, skip + limit);

    return messages.map(
      (msg) =>
        new Message({
          id: msg._id.toString(),
          chatId: chatId,
          content: msg.content,
          role: msg.role,
          metadata: msg.metadata,
          createdAt: msg.createdAt,
        }),
    );
  }

  async updateLastActivity(chatId: string): Promise<void> {
    this.logger.log(`Updating last activity for chat: ${chatId}`);

    await this.chatModel
      .findByIdAndUpdate(new Types.ObjectId(chatId), {
        lastActivity: new Date(),
        updatedAt: new Date(),
      })
      .exec();
  }

  async getUserChatCount(userId: string): Promise<number> {
    return this.chatModel.countDocuments({ userId }).exec();
  }

  async getActiveChatsForUser(userId: string): Promise<ChatSession[]> {
    const documents = await this.chatModel
      .find({ userId, isActive: true })
      .sort({ lastActivity: -1 })
      .exec();

    return documents.map((doc) => ChatSessionMapper.toDomain(doc));
  }
}
