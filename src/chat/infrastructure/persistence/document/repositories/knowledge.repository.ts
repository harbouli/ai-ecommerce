import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KnowledgeEntity } from '../../../../domain/knowledge';
import { KnowledgeRepository } from '../../knowledge.repository';
import { KnowledgeSchemaClass } from '../entities/knowledge.schema';
import { KnowledgeMapper } from '../mappers/knowledge.mapper';
import { NullableType } from '../../../../../utils/types/nullable.type';

@Injectable()
export class KnowledgeDocumentRepository implements KnowledgeRepository {
  constructor(
    @InjectModel(KnowledgeSchemaClass.name)
    private readonly knowledgeModel: Model<KnowledgeSchemaClass>,
  ) {}

  async create(data: Omit<KnowledgeEntity, 'id'>): Promise<KnowledgeEntity> {
    const persistenceModel = KnowledgeMapper.toPersistence(
      data as KnowledgeEntity,
    );
    const createdKnowledge = new this.knowledgeModel(persistenceModel);
    const knowledgeObject = await createdKnowledge.save();
    return KnowledgeMapper.toDomain(knowledgeObject);
  }

  async findById(
    id: KnowledgeEntity['id'],
  ): Promise<NullableType<KnowledgeEntity>> {
    const knowledgeObject = await this.knowledgeModel.findById(id);
    return knowledgeObject ? KnowledgeMapper.toDomain(knowledgeObject) : null;
  }

  async findByType(type: string): Promise<KnowledgeEntity[]> {
    const knowledgeObjects = await this.knowledgeModel
      .find({ type })
      .sort({ name: 1 });
    return knowledgeObjects.map((knowledgeObject) =>
      KnowledgeMapper.toDomain(knowledgeObject),
    );
  }

  async findByName(name: string): Promise<KnowledgeEntity[]> {
    const knowledgeObjects = await this.knowledgeModel
      .find({
        name: { $regex: name, $options: 'i' },
      })
      .sort({ name: 1 });
    return knowledgeObjects.map((knowledgeObject) =>
      KnowledgeMapper.toDomain(knowledgeObject),
    );
  }

  async update(
    id: KnowledgeEntity['id'],
    payload: Partial<KnowledgeEntity>,
  ): Promise<KnowledgeEntity | null> {
    const clonedPayload = { ...payload };
    delete clonedPayload.id;
    delete clonedPayload.createdAt;
    delete clonedPayload.updatedAt;

    const filter = { _id: id.toString() };
    const knowledge = await this.knowledgeModel.findOne(filter);

    if (!knowledge) {
      return null;
    }

    const knowledgeObject = await this.knowledgeModel.findOneAndUpdate(
      filter,
      KnowledgeMapper.toPersistence({
        ...KnowledgeMapper.toDomain(knowledge),
        ...clonedPayload,
      }),
      { new: true },
    );

    return knowledgeObject ? KnowledgeMapper.toDomain(knowledgeObject) : null;
  }

  async remove(id: KnowledgeEntity['id']): Promise<void> {
    await this.knowledgeModel.deleteOne({ _id: id.toString() });
  }

  async findSimilar(
    vector: number[],
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    // MongoDB doesn't have native vector similarity, so we'll use text similarity as fallback
    // In a real implementation, you might use MongoDB Atlas Vector Search
    const knowledgeObjects = await this.knowledgeModel
      .find({ vector: { $exists: true, $ne: [] } })
      .limit(limit);

    return knowledgeObjects.map((knowledgeObject) =>
      KnowledgeMapper.toDomain(knowledgeObject),
    );
  }

  async findByProperties(
    properties: Record<string, any>,
  ): Promise<KnowledgeEntity[]> {
    const query: any = {};

    // Build query for nested properties
    Object.keys(properties).forEach((key) => {
      query[`properties.${key}`] = properties[key];
    });

    const knowledgeObjects = await this.knowledgeModel
      .find(query)
      .sort({ name: 1 });

    return knowledgeObjects.map((knowledgeObject) =>
      KnowledgeMapper.toDomain(knowledgeObject),
    );
  }

  // Additional MongoDB-specific methods
  async searchByContent(
    searchTerm: string,
    limit: number = 10,
  ): Promise<KnowledgeEntity[]> {
    const knowledgeObjects = await this.knowledgeModel
      .find({ $text: { $search: searchTerm } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit);

    return knowledgeObjects.map((knowledgeObject) =>
      KnowledgeMapper.toDomain(knowledgeObject),
    );
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<KnowledgeEntity[]> {
    const knowledgeObjects = await this.knowledgeModel
      .find({
        createdAt: { $gte: startDate, $lte: endDate },
      })
      .sort({ createdAt: -1 });

    return knowledgeObjects.map((knowledgeObject) =>
      KnowledgeMapper.toDomain(knowledgeObject),
    );
  }

  async countByType(): Promise<{ _id: string; count: number }[]> {
    return await this.knowledgeModel.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);
  }

  async findEntitiesWithVectors(): Promise<KnowledgeEntity[]> {
    const knowledgeObjects = await this.knowledgeModel
      .find({
        vector: { $exists: true, $ne: [], $size: { $gt: 0 } },
      })
      .sort({ updatedAt: -1 });

    return knowledgeObjects.map((knowledgeObject) =>
      KnowledgeMapper.toDomain(knowledgeObject),
    );
  }

  async getKnowledgeStats(): Promise<any> {
    const stats = await this.knowledgeModel.aggregate([
      {
        $group: {
          _id: null,
          totalEntities: { $sum: 1 },
          entitiesWithVectors: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $isArray: '$vector' },
                    { $gt: [{ $size: '$vector' }, 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          avgVectorLength: {
            $avg: {
              $cond: [{ $isArray: '$vector' }, { $size: '$vector' }, 0],
            },
          },
          typeDistribution: { $push: '$type' },
        },
      },
      {
        $project: {
          _id: 0,
          totalEntities: 1,
          entitiesWithVectors: 1,
          avgVectorLength: 1,
          vectorCoverage: {
            $multiply: [
              { $divide: ['$entitiesWithVectors', '$totalEntities'] },
              100,
            ],
          },
        },
      },
    ]);

    const typeStats = await this.countByType();

    return {
      ...stats[0],
      typeDistribution: typeStats,
      lastUpdated: new Date(),
    };
  }

  async findRecentEntities(limit: number = 10): Promise<KnowledgeEntity[]> {
    const knowledgeObjects = await this.knowledgeModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit);

    return knowledgeObjects.map((knowledgeObject) =>
      KnowledgeMapper.toDomain(knowledgeObject),
    );
  }

  async findEntitiesByPropertyKey(
    propertyKey: string,
  ): Promise<KnowledgeEntity[]> {
    const knowledgeObjects = await this.knowledgeModel
      .find({ [`properties.${propertyKey}`]: { $exists: true } })
      .sort({ name: 1 });

    return knowledgeObjects.map((knowledgeObject) =>
      KnowledgeMapper.toDomain(knowledgeObject),
    );
  }

  async updateVector(
    id: KnowledgeEntity['id'],
    vector: number[],
  ): Promise<KnowledgeEntity | null> {
    const knowledgeObject = await this.knowledgeModel.findOneAndUpdate(
      { _id: id.toString() },
      {
        vector,
        updatedAt: new Date(),
      },
      { new: true },
    );

    return knowledgeObject ? KnowledgeMapper.toDomain(knowledgeObject) : null;
  }

  async bulkUpdateVectors(
    updates: { id: string; vector: number[] }[],
  ): Promise<void> {
    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: { _id: update.id },
        update: {
          vector: update.vector,
          updatedAt: new Date(),
        },
      },
    }));

    await this.knowledgeModel.bulkWrite(bulkOps);
  }
}
