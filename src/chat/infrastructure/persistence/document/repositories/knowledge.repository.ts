/* eslint-disable @typescript-eslint/require-await */
// src/chat/infrastructure/persistence/document/repositories/knowledge.repository.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KnowledgeEntity } from '../../../../domain/knowledge';
import { KnowledgeRepository } from '../../knowledge.repository';
import {
  KnowledgeSchemaClass,
  KnowledgeSchemaDocument,
} from '../entities/knowledge.schema';
import { KnowledgeMapper } from '../mappers/knowledge.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';

@Injectable()
export class KnowledgeDocumentRepository implements KnowledgeRepository {
  private readonly logger = new Logger(KnowledgeDocumentRepository.name);

  constructor(
    @InjectModel(KnowledgeSchemaClass.name)
    private readonly knowledgeModel: Model<KnowledgeSchemaDocument>,
  ) {}

  async create(data: Omit<KnowledgeEntity, 'id'>): Promise<KnowledgeEntity> {
    const persistenceModel = KnowledgeMapper.toCreatePersistence(data);
    const createdKnowledge = new this.knowledgeModel(persistenceModel);
    const knowledgeObject = await createdKnowledge.save();
    return KnowledgeMapper.toDomain(knowledgeObject);
  }

  async findById(id: string): Promise<NullableType<KnowledgeEntity>> {
    const knowledgeObject = await this.knowledgeModel.findById(id).exec();
    return knowledgeObject ? KnowledgeMapper.toDomain(knowledgeObject) : null;
  }

  async findByType(type: KnowledgeEntity['type']): Promise<KnowledgeEntity[]> {
    const knowledgeObjects = await this.knowledgeModel.find({ type }).exec();
    return knowledgeObjects.map((knowledge) =>
      KnowledgeMapper.toDomain(knowledge),
    );
  }

  async findByName(name: string): Promise<KnowledgeEntity[]> {
    const knowledgeObjects = await this.knowledgeModel
      .find({ name: { $regex: name, $options: 'i' } })
      .exec();
    return knowledgeObjects.map((knowledge) =>
      KnowledgeMapper.toDomain(knowledge),
    );
  }

  async findByCategory(category: string): Promise<KnowledgeEntity[]> {
    const knowledgeObjects = await this.knowledgeModel
      .find({ 'properties.category': category })
      .exec();
    return knowledgeObjects.map((knowledge) =>
      KnowledgeMapper.toDomain(knowledge),
    );
  }

  async findByBrand(brand: string): Promise<KnowledgeEntity[]> {
    const knowledgeObjects = await this.knowledgeModel
      .find({ 'properties.brand': brand })
      .exec();
    return knowledgeObjects.map((knowledge) =>
      KnowledgeMapper.toDomain(knowledge),
    );
  }

  async findByProperties(
    properties: Record<string, any>,
  ): Promise<KnowledgeEntity[]> {
    const query: Record<string, any> = {};

    Object.keys(properties).forEach((key) => {
      query[`properties.${key}`] = properties[key];
    });

    const knowledgeObjects = await this.knowledgeModel.find(query).exec();
    return knowledgeObjects.map((knowledge) =>
      KnowledgeMapper.toDomain(knowledge),
    );
  }

  async update(
    id: string,
    payload: Partial<KnowledgeEntity>,
  ): Promise<KnowledgeEntity | null> {
    const updatedKnowledge = await this.knowledgeModel
      .findByIdAndUpdate(id, payload, { new: true })
      .exec();

    return updatedKnowledge ? KnowledgeMapper.toDomain(updatedKnowledge) : null;
  }

  async remove(id: string): Promise<void> {
    await this.knowledgeModel.findByIdAndDelete(id).exec();
  }

  // Shopping-specific search methods
  async searchProducts(
    searchTerm: string,
    filters?: Record<string, any>,
  ): Promise<KnowledgeEntity[]> {
    const query: any = {
      type: 'PRODUCT',
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { 'properties.tags': { $in: [new RegExp(searchTerm, 'i')] } },
      ],
    };

    if (filters) {
      Object.keys(filters).forEach((key) => {
        if (filters[key]) {
          query[`properties.${key}`] = filters[key];
        }
      });
    }

    const products = await this.knowledgeModel.find(query).exec();
    return products.map((product) => KnowledgeMapper.toDomain(product));
  }

  async findProductsByPriceRange(
    minPrice: number,
    maxPrice: number,
  ): Promise<KnowledgeEntity[]> {
    const products = await this.knowledgeModel
      .find({
        type: 'PRODUCT',
        'properties.price': { $gte: minPrice, $lte: maxPrice },
      })
      .exec();

    return products.map((product) => KnowledgeMapper.toDomain(product));
  }

  async findTopProducts(
    category?: string,
    limit = 10,
  ): Promise<KnowledgeEntity[]> {
    const query: any = { type: 'PRODUCT' };

    if (category) {
      query['properties.category'] = category;
    }

    const products = await this.knowledgeModel
      .find(query)
      .sort({ 'properties.rating': -1, 'properties.salesCount': -1 })
      .limit(limit)
      .exec();

    return products.map((product) => KnowledgeMapper.toDomain(product));
  }

  // Implement abstract methods that aren't shopping-specific
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findSimilar(vector: number[], limit = 10): Promise<KnowledgeEntity[]> {
    // This would typically be handled by the vector repository
    // For MongoDB, we'll do a simple fallback search
    this.logger.warn(
      'findSimilar called on MongoDB repository - consider using vector repository',
    );
    return [];
  }

  async semanticSearch(query: string, limit = 10): Promise<KnowledgeEntity[]> {
    // Simple text search fallback
    const knowledgeObjects = await this.knowledgeModel
      .find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
      })
      .limit(limit)
      .exec();

    return knowledgeObjects.map((knowledge) =>
      KnowledgeMapper.toDomain(knowledge),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findRelated(entityId: string, hops = 2): Promise<KnowledgeEntity[]> {
    // This would typically be handled by the graph repository
    this.logger.warn(
      'findRelated called on MongoDB repository - consider using graph repository',
    );
    return [];
  }

  async findRecommendations(
    entityId: string,
    limit = 5,
  ): Promise<KnowledgeEntity[]> {
    // Simple recommendations based on same category/brand
    const entity = await this.findById(entityId);
    if (!entity || entity.type !== 'PRODUCT') return [];

    const category = entity.properties?.category;
    const brand = entity.properties?.brand;

    const query: any = {
      type: 'PRODUCT',
      _id: { $ne: entityId },
    };

    if (category) {
      query['properties.category'] = category;
    } else if (brand) {
      query['properties.brand'] = brand;
    }

    const recommendations = await this.knowledgeModel
      .find(query)
      .sort({ 'properties.rating': -1 })
      .limit(limit)
      .exec();

    return recommendations.map((rec) => KnowledgeMapper.toDomain(rec));
  }

  async hybridSearch(
    query: string,
    filters: Record<string, any> = {},
  ): Promise<KnowledgeEntity[]> {
    // Simple hybrid search implementation for MongoDB
    const searchQuery: any = {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
      ],
    };

    // Apply filters
    Object.keys(filters).forEach((key) => {
      if (filters[key] && key !== 'limit') {
        if (key === 'type') {
          searchQuery.type = filters[key];
        } else {
          searchQuery[`properties.${key}`] = filters[key];
        }
      }
    });

    const limit = filters.limit || 20;
    const results = await this.knowledgeModel
      .find(searchQuery)
      .limit(limit)
      .exec();

    return results.map((result) => KnowledgeMapper.toDomain(result));
  }
}
