import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
  model: string;
  tokensUsed?: number;
}

export interface SimilaritySearchRequest {
  queryEmbedding: number[];
  candidateTexts: string[];
  threshold?: number;
  limit?: number;
}

export interface SimilarityResult {
  text: string;
  similarity: number;
  index: number;
}

export interface KnowledgeChunk {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: {
    source?: string;
    category?: string;
    timestamp?: Date;
    [key: string]: any;
  };
}

export interface RetrievalRequest {
  query: string;
  knowledgeBase: KnowledgeChunk[];
  topK?: number;
  threshold?: number;
}

export interface RetrievalResult {
  chunks: Array<{
    chunk: KnowledgeChunk;
    similarity: number;
    relevanceScore: number;
  }>;
  queryEmbedding: number[];
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly mistralClient: Mistral;

  constructor(private readonly configService: ConfigService) {
    // eslint-disable-next-line no-restricted-syntax
    const apiKey = this.configService.get<string>('MISTRAL_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'MISTRAL_API_KEY not found. Embedding functionality will be limited.',
      );
    }

    this.mistralClient = new Mistral({
      apiKey: apiKey || '',
    });
  }

  /**
   * Generate embeddings for text using Mistral AI
   */
  async generateEmbedding(
    request: EmbeddingRequest,
  ): Promise<EmbeddingResponse> {
    this.logger.log(
      `Generating embedding for text: ${request.text.substring(0, 100)}...`,
    );

    try {
      const model = request.model || 'mistral-embed';

      const embeddingResponse = await this.mistralClient.embeddings.create({
        model: model,
        inputs: [request.text],
      });

      const embedding = embeddingResponse.data?.[0]?.embedding;
      if (!embedding) {
        throw new Error('No embedding returned from Mistral AI');
      }

      return {
        embedding,
        dimensions: embedding.length,
        model: model,
        tokensUsed: embeddingResponse.usage?.totalTokens,
      };
    } catch (error) {
      this.logger.error(`Embedding generation failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateBatchEmbeddings(
    texts: string[],
    model: string = 'mistral-embed',
  ): Promise<EmbeddingResponse[]> {
    this.logger.log(`Generating batch embeddings for ${texts.length} texts`);

    try {
      const embeddingResponse = await this.mistralClient.embeddings.create({
        model: model,
        inputs: texts,
      });

      if (!embeddingResponse.data) {
        throw new Error('No embeddings returned from Mistral AI');
      }

      return embeddingResponse.data
        .filter((item) => item.embedding !== undefined)
        .map((item) => ({
          embedding: item.embedding as number[],
          dimensions: item.embedding!.length,
          model: model,
          tokensUsed: embeddingResponse.usage?.totalTokens
            ? Math.floor(embeddingResponse.usage.totalTokens / texts.length)
            : undefined,
        }));
    } catch (error) {
      this.logger.error(
        `Batch embedding generation failed: ${error.message}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateCosineSimilarity(
    embedding1: number[],
    embedding2: number[],
  ): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Find most similar texts to a query embedding
   */
  async findSimilarTexts(
    request: SimilaritySearchRequest,
  ): Promise<SimilarityResult[]> {
    this.logger.log(
      `Finding similar texts for query, ${request.candidateTexts.length} candidates`,
    );

    const results: SimilarityResult[] = [];
    const threshold = request.threshold || 0.0;

    // Generate embeddings for candidate texts if needed
    const candidateEmbeddings = await this.generateBatchEmbeddings(
      request.candidateTexts,
    );

    // Calculate similarities
    for (let i = 0; i < request.candidateTexts.length; i++) {
      const similarity = this.calculateCosineSimilarity(
        request.queryEmbedding,
        candidateEmbeddings[i].embedding,
      );

      if (similarity >= threshold) {
        results.push({
          text: request.candidateTexts[i],
          similarity,
          index: i,
        });
      }
    }

    // Sort by similarity (descending) and limit results
    results.sort((a, b) => b.similarity - a.similarity);

    const limit = request.limit || results.length;
    return results.slice(0, limit);
  }

  /**
   * Core KAG method: Retrieve relevant knowledge chunks for a query
   */
  async retrieveRelevantKnowledge(
    request: RetrievalRequest,
  ): Promise<RetrievalResult> {
    this.logger.log(
      `Retrieving relevant knowledge for query: ${request.query.substring(0, 100)}...`,
    );

    try {
      // Generate embedding for the query
      const queryEmbeddingResponse = await this.generateEmbedding({
        text: request.query,
      });

      const topK = request.topK || 5;
      const threshold = request.threshold || 0.3;
      const results: Array<{
        chunk: KnowledgeChunk;
        similarity: number;
        relevanceScore: number;
      }> = [];

      // Calculate similarities with all knowledge chunks
      for (const chunk of request.knowledgeBase) {
        let chunkEmbedding = chunk.embedding;

        // Generate embedding if not cached
        if (!chunkEmbedding) {
          const embeddingResponse = await this.generateEmbedding({
            text: chunk.content,
          });
          chunkEmbedding = embeddingResponse.embedding;
        }

        const similarity = this.calculateCosineSimilarity(
          queryEmbeddingResponse.embedding,
          chunkEmbedding,
        );

        if (similarity >= threshold) {
          // Calculate relevance score (can be enhanced with more factors)
          const relevanceScore = this.calculateRelevanceScore(
            similarity,
            chunk,
            request.query,
          );

          results.push({
            chunk: {
              ...chunk,
              embedding: chunkEmbedding, // Cache the embedding
            },
            similarity,
            relevanceScore,
          });
        }
      }

      // Sort by relevance score and return top K
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      return {
        chunks: results.slice(0, topK),
        queryEmbedding: queryEmbeddingResponse.embedding,
      };
    } catch (error) {
      this.logger.error(`Knowledge retrieval failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Enhanced method for chatbot: Retrieve context for conversation
   */
  async retrieveConversationalContext(
    query: string,
    conversationHistory: string[],
    knowledgeBase: KnowledgeChunk[],
    options: {
      topK?: number;
      threshold?: number;
      includeHistory?: boolean;
      historyWeight?: number;
    } = {},
  ): Promise<{
    relevantKnowledge: KnowledgeChunk[];
    contextualPrompt: string;
    similarities: number[];
  }> {
    this.logger.log(`Retrieving conversational context for chatbot`);

    const topK = options.topK || 3;
    const threshold = options.threshold || 0.4;
    const includeHistory = options.includeHistory ?? true;

    // Enhance query with recent conversation context
    let enhancedQuery = query;
    if (includeHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-3).join(' ');
      enhancedQuery = `${recentHistory} ${query}`;
    }

    // Retrieve relevant knowledge
    const retrievalResult = await this.retrieveRelevantKnowledge({
      query: enhancedQuery,
      knowledgeBase,
      topK,
      threshold,
    });

    const relevantChunks = retrievalResult.chunks.map((result) => result.chunk);
    const similarities = retrievalResult.chunks.map(
      (result) => result.similarity,
    );

    // Build contextual prompt for the chatbot
    const contextualPrompt = this.buildContextualPrompt(
      query,
      relevantChunks,
      conversationHistory,
      includeHistory,
    );

    return {
      relevantKnowledge: relevantChunks,
      contextualPrompt,
      similarities,
    };
  }

  /**
   * Calculate relevance score considering multiple factors
   */
  private calculateRelevanceScore(
    similarity: number,
    chunk: KnowledgeChunk,
    query: string,
  ): number {
    let score = similarity;

    // Boost score for exact keyword matches
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = chunk.content.toLowerCase().split(/\s+/);
    const keywordMatches = queryWords.filter((word) =>
      contentWords.some((contentWord) => contentWord.includes(word)),
    ).length;

    const keywordBoost = (keywordMatches / queryWords.length) * 0.1;
    score += keywordBoost;

    // Consider recency if timestamp is available
    if (chunk.metadata?.timestamp) {
      const daysSinceUpdate =
        (Date.now() - chunk.metadata.timestamp.getTime()) /
        (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0, (30 - daysSinceUpdate) / 30) * 0.05;
      score += recencyBoost;
    }

    // Boost based on content length (prefer detailed content)
    const lengthBoost = Math.min(chunk.content.length / 1000, 1) * 0.02;
    score += lengthBoost;

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Build contextual prompt for the chatbot
   */
  private buildContextualPrompt(
    query: string,
    relevantChunks: KnowledgeChunk[],
    conversationHistory: string[],
    includeHistory: boolean,
  ): string {
    let prompt = '';

    // Add conversation history if requested
    if (includeHistory && conversationHistory.length > 0) {
      prompt += 'Previous conversation:\n';
      conversationHistory.slice(-3).forEach((message, index) => {
        prompt += `${index % 2 === 0 ? 'User' : 'Assistant'}: ${message}\n`;
      });
      prompt += '\n';
    }

    // Add relevant knowledge context
    if (relevantChunks.length > 0) {
      prompt += 'Relevant knowledge:\n';
      relevantChunks.forEach((chunk, index) => {
        prompt += `[${index + 1}] ${chunk.content}\n`;
        if (chunk.metadata?.source) {
          prompt += `   Source: ${chunk.metadata.source}\n`;
        }
      });
      prompt += '\n';
    }

    // Add the current query
    prompt += `Current question: ${query}\n\n`;
    prompt +=
      "Please provide a helpful response based on the relevant knowledge above. If the knowledge doesn't contain sufficient information to answer the question, please say so clearly.";

    return prompt;
  }

  /**
   * Health check for the embedding service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test with a simple embedding request
      await this.generateEmbedding({
        text: 'health check test',
        model: 'mistral-embed',
      });
      return true;
    } catch (error) {
      this.logger.error('Embedding service health check failed', error);
      return false;
    }
  }
}
