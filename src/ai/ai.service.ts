import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateAiSessionDto } from './dto/create-ai-session.dto';
import { GenerateTextDto } from './dto/generate-text.dto';
import { AnalyzeImageDto } from './dto/analyze-image.dto';
import { GenerateEmbeddingDto } from './dto/generate-embedding.dto';
import { AiSessionResponseDto } from './dto/ai-session-response.dto';
import { AiGenerationResponseDto } from './dto/ai-generation-response.dto';
import { AiAnalysisResponseDto } from './dto/ai-analysis-response.dto';
import { AiEmbeddingResponseDto } from './dto/ai-embedding-response.dto';
import { AiSession } from './domain/ai-session';
import { AiInteraction } from './domain/ai-interaction';
import { AiRepository } from './infrastructure/persistence/ai.repository';
import { TextGenerationService } from './infrastructure/services/text-generation.service';
import { ImageAnalysisService } from './infrastructure/services/image-analysis.service';
import { EmbeddingService } from './infrastructure/services/embedding.service';
import { UpdateAiSessionDto } from './dto/update-ai-session.dto';
export interface PaginationOptions {
  page: number;
  limit: number;
}

export type ImageAnalysisType =
  | 'product_analysis'
  | 'text_extraction'
  | 'object_detection'
  | 'visual_qa';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly aiRepository: AiRepository,
    private readonly textGenerationService: TextGenerationService,
    private readonly imageAnalysisService: ImageAnalysisService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async createSession(
    createAiSessionDto: CreateAiSessionDto & { userId: string },
  ): Promise<AiSessionResponseDto> {
    this.logger.log(
      `Creating new AI session for user: ${createAiSessionDto.userId}`,
    );

    const aiSession = new AiSession({
      title: createAiSessionDto.title || 'New AI Session',
      userId: createAiSessionDto.userId,
      context: createAiSessionDto.context,
      configuration: createAiSessionDto.configuration,
      isActive: true,
    });

    const createdSession = await this.aiRepository.createSession(aiSession);

    this.logger.log(`AI session created with ID: ${createdSession.id}`);
    return this.mapSessionToResponseDto(createdSession);
  }

  async findAllSessionsByUser(
    userId: string,
    paginationOptions: PaginationOptions,
  ): Promise<AiSessionResponseDto[]> {
    this.logger.log(`Finding all AI sessions for user: ${userId}`);

    const sessions = await this.aiRepository.findSessionsByUserId(
      userId,
      paginationOptions,
    );
    return sessions.map((session) => this.mapSessionToResponseDto(session));
  }

  async findOneSessionByUser(
    id: string,
    userId: string,
  ): Promise<AiSessionResponseDto> {
    this.logger.log(`Finding AI session: ${id} for user: ${userId}`);

    const session = await this.aiRepository.findSessionById(id);

    if (!session) {
      throw new NotFoundException(`AI session with ID ${id} not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Access denied to this AI session');
    }

    return this.mapSessionToResponseDto(session);
  }

  async updateSession(
    id: string,
    updateAiSessionDto: UpdateAiSessionDto,
    userId: string,
  ): Promise<AiSessionResponseDto> {
    this.logger.log(`Updating AI session: ${id}`);

    const existingSession = await this.findOneSessionByUser(id, userId);

    const updatedSession = await this.aiRepository.updateSession(id, {
      title: updateAiSessionDto.title ?? existingSession.title,
      context: updateAiSessionDto.context ?? existingSession.context,
      configuration:
        updateAiSessionDto.configuration ?? existingSession.configuration,
      updatedAt: new Date(),
    });

    return this.mapSessionToResponseDto(updatedSession);
  }

  async removeSession(id: string, userId: string): Promise<void> {
    this.logger.log(`Removing AI session: ${id}`);

    await this.findOneSessionByUser(id, userId); // Verify ownership
    await this.aiRepository.deleteSession(id);

    this.logger.log(`AI session ${id} deleted successfully`);
  }

  async generateText(
    generateTextDto: GenerateTextDto,
    userId: string,
  ): Promise<AiGenerationResponseDto> {
    this.logger.log(`Generating text for user: ${userId}`);

    try {
      const startTime = Date.now();

      // Generate text using the specified model
      const generationResult = await this.textGenerationService.generateText({
        prompt: generateTextDto.prompt,
        model: generateTextDto.model || 'mistral-7b',
        maxTokens: generateTextDto.maxTokens || 1000,
        temperature: generateTextDto.temperature || 0.7,
        systemPrompt: generateTextDto.systemPrompt,
        context: generateTextDto.context,
      });

      const processingTime = Date.now() - startTime;

      // Create interaction record
      const interaction = new AiInteraction({
        sessionId: generateTextDto.sessionId,
        userId,
        interactionType: 'text_generation',
        input: {
          prompt: generateTextDto.prompt,
          model: generateTextDto.model,
          parameters: {
            maxTokens: generateTextDto.maxTokens,
            temperature: generateTextDto.temperature,
          },
        },
        output: {
          generatedText: generationResult.text,
          tokensUsed: generationResult.tokensUsed,
          model: generationResult.model,
        },
        metadata: {
          processingTime,
          confidence: generationResult.confidence,
        },
      });

      // Save interaction if session provided
      if (generateTextDto.sessionId) {
        await this.aiRepository.addInteraction(interaction);
      }

      return {
        generatedText: generationResult.text,
        model: generationResult.model,
        tokensUsed: generationResult.tokensUsed,
        confidence: generationResult.confidence,
        processingTime,
        sessionId: generateTextDto.sessionId,
        interactionId: interaction.id,
      };
    } catch (error) {
      this.logger.error(`Text generation failed: ${error.message}`, error);
      throw error;
    }
  }

  async analyzeImage(
    analyzeImageDto: AnalyzeImageDto,
    userId: string,
  ): Promise<AiAnalysisResponseDto> {
    this.logger.log(`Analyzing image for user: ${userId}`);

    try {
      const startTime = Date.now();

      const analysisResult = await this.imageAnalysisService.analyzeImage({
        imageUrl: analyzeImageDto.imageUrl,
        imageData: analyzeImageDto.imageData,
        analysisType: analyzeImageDto.analysisType as
          | 'product_analysis'
          | 'text_extraction'
          | 'object_detection'
          | 'visual_qa',
        model: analyzeImageDto.model || 'vision-transformer',
      });

      const processingTime = Date.now() - startTime;

      // Create interaction record
      const interaction = new AiInteraction({
        sessionId: analyzeImageDto.sessionId,
        userId,
        interactionType: 'image_analysis',
        input: {
          imageUrl: analyzeImageDto.imageUrl,
          analysisType: analyzeImageDto.analysisType,
          model: analyzeImageDto.model,
        },
        output: {
          analysis: analysisResult.analysis,
          confidence: analysisResult.confidence,
          detectedObjects: analysisResult.detectedObjects,
          extractedText: analysisResult.extractedText,
        },
        metadata: {
          processingTime,
        },
      });

      if (analyzeImageDto.sessionId) {
        await this.aiRepository.addInteraction(interaction);
      }

      return {
        analysis: analysisResult.analysis,
        confidence: analysisResult.confidence,
        detectedObjects: analysisResult.detectedObjects || [],
        extractedText: analysisResult.extractedText,
        model: analysisResult.model,
        processingTime,
        sessionId: analyzeImageDto.sessionId,
        interactionId: interaction.id,
      };
    } catch (error) {
      this.logger.error(`Image analysis failed: ${error.message}`, error);
      throw error;
    }
  }

  async generateEmbedding(
    generateEmbeddingDto: GenerateEmbeddingDto,
    userId: string,
  ): Promise<AiEmbeddingResponseDto> {
    this.logger.log(`Generating embedding for user: ${userId}`);

    try {
      const startTime = Date.now();

      const embeddingResult = await this.embeddingService.generateEmbedding({
        text: generateEmbeddingDto.text,
        model: generateEmbeddingDto.model || 'text-embedding-ada-002',
      });

      const processingTime = Date.now() - startTime;

      // Create interaction record
      const interaction = new AiInteraction({
        sessionId: generateEmbeddingDto.sessionId,
        userId,
        interactionType: 'embedding_generation',
        input: {
          text: generateEmbeddingDto.text,
          model: generateEmbeddingDto.model,
        },
        output: {
          embedding: embeddingResult.embedding,
          dimensions: embeddingResult.dimensions,
        },
        metadata: {
          processingTime,
        },
      });

      if (generateEmbeddingDto.sessionId) {
        await this.aiRepository.addInteraction(interaction);
      }

      return {
        embedding: embeddingResult.embedding,
        dimensions: embeddingResult.dimensions,
        model: embeddingResult.model,
        processingTime,
        sessionId: generateEmbeddingDto.sessionId,
        interactionId: interaction.id,
      };
    } catch (error) {
      this.logger.error(`Embedding generation failed: ${error.message}`, error);
      throw error;
    }
  }

  async getUserUsageStats(userId: string): Promise<{
    totalRequests: number;
    tokensUsed: number;
    modelsUsed: string[];
    lastActivity: Date;
    monthlyUsage: Record<string, number>;
  }> {
    return this.aiRepository.getUserUsageStats(userId);
  }

  private mapSessionToResponseDto(aiSession: AiSession): AiSessionResponseDto {
    return {
      id: aiSession.id!,
      title: aiSession.title,
      userId: aiSession.userId,
      sessionType: aiSession.sessionType,
      context: aiSession.context,
      configuration: aiSession.configuration,
      isActive: aiSession.isActive,
      interactionCount: aiSession.interactions?.length || 0,
      createdAt: aiSession.createdAt!,
      updatedAt: aiSession.updatedAt!,
      lastActivity: aiSession.lastActivity,
    };
  }
}
