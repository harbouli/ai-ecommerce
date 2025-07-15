import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AiSessionDocument,
  AiSessionSchema,
} from '../entities/ai-session.schema';
import { AiSessionMapper } from '../mappers/ai-session.mapper';
import { AiRepository, PaginationOptions } from '../../ai.repository';
import { AiSession } from '../../../../domain/ai-session';
import { AiInteraction } from '../../../../domain/ai-interaction';

@Injectable()
export class AiDocumentRepository implements AiRepository {
  private readonly logger = new Logger(AiDocumentRepository.name);

  constructor(
    @InjectModel(AiSessionSchema.name)
    private readonly aiSessionModel: Model<AiSessionDocument>,
  ) {}

  async createSession(aiSession: AiSession): Promise<AiSession> {
    this.logger.log(`Creating new AI session for user: ${aiSession.userId}`);

    const documentData = AiSessionMapper.toDocument(aiSession);
    const document = new this.aiSessionModel(documentData);
    const savedDocument = await document.save();

    return AiSessionMapper.toDomain(savedDocument);
  }

  async findSessionById(id: string): Promise<AiSession | null> {
    this.logger.log(`Finding AI session by ID: ${id}`);

    try {
      const document = await this.aiSessionModel
        .findById(new Types.ObjectId(id))
        .exec();

      return document ? AiSessionMapper.toDomain(document) : null;
    } catch (error) {
      this.logger.error(`Error finding AI session ${id}:`, error);
      return null;
    }
  }

  async findSessionsByUserId(
    userId: string,
    paginationOptions: PaginationOptions,
  ): Promise<AiSession[]> {
    this.logger.log(`Finding AI sessions for user: ${userId}`);

    const { page, limit } = paginationOptions;
    const skip = (page - 1) * limit;

    const documents = await this.aiSessionModel
      .find({ userId })
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return documents.map((doc) => AiSessionMapper.toDomain(doc));
  }

  async updateSession(
    id: string,
    updateData: Partial<AiSession>,
  ): Promise<AiSession> {
    this.logger.log(`Updating AI session: ${id}`);

    const document = await this.aiSessionModel
      .findByIdAndUpdate(
        new Types.ObjectId(id),
        { ...updateData, updatedAt: new Date() },
        { new: true },
      )
      .exec();

    if (!document) {
      throw new NotFoundException(`AI session with ID ${id} not found`);
    }

    return AiSessionMapper.toDomain(document);
  }

  async deleteSession(id: string): Promise<void> {
    this.logger.log(`Deleting AI session: ${id}`);

    const result = await this.aiSessionModel
      .findByIdAndDelete(new Types.ObjectId(id))
      .exec();

    if (!result) {
      throw new NotFoundException(`AI session with ID ${id} not found`);
    }
  }

  async addInteraction(interaction: AiInteraction): Promise<AiInteraction> {
    this.logger.log(`Adding interaction to session: ${interaction.sessionId}`);

    const interactionData = {
      _id: new Types.ObjectId(),
      interactionType: interaction.interactionType,
      input: interaction.input,
      output: interaction.output,
      metadata: interaction.metadata,
      createdAt: new Date(),
    };

    const document = await this.aiSessionModel
      .findByIdAndUpdate(
        new Types.ObjectId(interaction.sessionId),
        {
          $push: { interactions: interactionData },
          $set: { lastActivity: new Date(), updatedAt: new Date() },
        },
        { new: true },
      )
      .exec();

    if (!document) {
      throw new NotFoundException(
        `AI session with ID ${interaction.sessionId} not found`,
      );
    }

    return new AiInteraction({
      id: interactionData._id.toString(),
      sessionId: interaction.sessionId,
      userId: interaction.userId,
      interactionType: interaction.interactionType,
      input: interaction.input,
      output: interaction.output,
      metadata: interaction.metadata,
      createdAt: interactionData.createdAt,
    });
  }

  async getSessionInteractions(
    sessionId: string,
    paginationOptions: PaginationOptions,
  ): Promise<AiInteraction[]> {
    this.logger.log(`Getting interactions for session: ${sessionId}`);

    const document = await this.aiSessionModel
      .findById(new Types.ObjectId(sessionId))
      .select('interactions userId')
      .exec();

    if (!document) {
      throw new NotFoundException(`AI session with ID ${sessionId} not found`);
    }

    const { page, limit } = paginationOptions;
    const skip = (page - 1) * limit;

    const interactions = document.interactions
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(skip, skip + limit);

    return interactions.map(
      (interaction) =>
        new AiInteraction({
          id: interaction._id.toString(),
          sessionId: sessionId,
          userId: document.userId,
          interactionType: interaction.interactionType,
          input: interaction.input,
          output: interaction.output,
          metadata: interaction.metadata,
          createdAt: interaction.createdAt,
        }),
    );
  }

  async getUserUsageStats(userId: string): Promise<{
    totalRequests: number;
    tokensUsed: number;
    modelsUsed: string[];
    lastActivity: Date;
    monthlyUsage: Record<string, number>;
  }> {
    const sessions = await this.aiSessionModel
      .find({ userId })
      .select('interactions lastActivity')
      .exec();

    let totalRequests = 0;
    let tokensUsed = 0;
    const modelsUsed = new Set<string>();
    let lastActivity = new Date(0);
    const monthlyUsage: Record<string, number> = {};

    sessions.forEach((session) => {
      if (session.lastActivity > lastActivity) {
        lastActivity = session.lastActivity;
      }

      session.interactions.forEach((interaction) => {
        totalRequests++;

        const tokens =
          interaction.output?.tokensUsed ||
          interaction.metadata?.tokensUsed ||
          0;
        tokensUsed += tokens;

        const model = interaction.output?.model || interaction.input?.model;
        if (model) {
          modelsUsed.add(model);
        }

        const month = interaction.createdAt.toISOString().substring(0, 7); // YYYY-MM
        monthlyUsage[month] = (monthlyUsage[month] || 0) + 1;
      });
    });

    return {
      totalRequests,
      tokensUsed,
      modelsUsed: Array.from(modelsUsed),
      lastActivity,
      monthlyUsage,
    };
  }
}
