import { ApiProperty } from '@nestjs/swagger';
import { IntentClassification } from './intent-classification';
import { ExtractedEntity } from './extracted-entity';

export class QueryAnalysis {
  @ApiProperty({
    type: () => IntentClassification,
    description: 'Intent classification result for the user query',
  })
  intent: IntentClassification;

  @ApiProperty({
    type: [ExtractedEntity],
    description: 'List of entities extracted from the user query',
    isArray: true,
  })
  entities: ExtractedEntity[];

  @ApiProperty({
    type: Number,
    example: 1850,
    description: 'Total processing time for the analysis in milliseconds',
    minimum: 0,
  })
  processingTime: number;

  constructor(
    intent: IntentClassification,
    entities: ExtractedEntity[],
    processingTime: number,
  ) {
    this.intent = intent;
    this.entities = entities;
    this.processingTime = processingTime;
  }

  /**
   * Get entities filtered by type
   */
  getEntitiesByType(entityType: string): ExtractedEntity[] {
    return this.entities.filter((entity) => entity.type === entityType);
  }

  /**
   * Get entities with confidence above threshold
   */
  getHighConfidenceEntities(threshold: number = 0.8): ExtractedEntity[] {
    return this.entities.filter((entity) => entity.confidence >= threshold);
  }

  /**
   * Check if analysis contains specific entity type
   */
  hasEntityType(entityType: string): boolean {
    return this.entities.some((entity) => entity.type === entityType);
  }

  /**
   * Get vehicle-related entities (brand, model, year)
   */
  getVehicleEntities(): ExtractedEntity[] {
    return this.entities.filter((entity) => entity.isVehicleEntity());
  }

  /**
   * Get part-related entities
   */
  getPartEntities(): ExtractedEntity[] {
    return this.entities.filter((entity) => entity.isPartEntity());
  }

  /**
   * Get commercial entities (price, quantity, condition)
   */
  getCommercialEntities(): ExtractedEntity[] {
    return this.entities.filter((entity) => entity.isCommercialEntity());
  }

  /**
   * Get unique entity types found in the query
   */
  getUniqueEntityTypes(): string[] {
    return [...new Set(this.entities.map((entity) => entity.type))];
  }

  /**
   * Check if this is a high-quality analysis
   */
  isHighQuality(): boolean {
    return (
      this.intent.isHighConfidence() &&
      this.entities.length > 0 &&
      this.processingTime < 5000 // Less than 5 seconds
    );
  }

  /**
   * Get analysis summary
   */
  getSummary(): {
    intent: string;
    intentConfidence: number;
    entityCount: number;
    entityTypes: string[];
    hasVehicleInfo: boolean;
    hasPartInfo: boolean;
    processingTime: number;
  } {
    return {
      intent: this.intent.intent,
      intentConfidence: this.intent.confidence,
      entityCount: this.entities.length,
      entityTypes: this.getUniqueEntityTypes(),
      hasVehicleInfo: this.getVehicleEntities().length > 0,
      hasPartInfo: this.getPartEntities().length > 0,
      processingTime: this.processingTime,
    };
  }

  /**
   * Check if user provided sufficient context for shopping
   */
  hasSufficientShoppingContext(): boolean {
    const hasVehicleInfo =
      this.hasEntityType('CAR_BRAND') || this.hasEntityType('CAR_MODEL');
    const hasPartInfo = this.hasEntityType('CAR_PART');
    const isShoppingIntent = this.intent.isShoppingIntent();

    return isShoppingIntent && (hasVehicleInfo || hasPartInfo);
  }
}
