import { ApiProperty } from '@nestjs/swagger';

export class ExtractedEntity {
  @ApiProperty({
    type: String,
    example: 'brake pads',
    description: 'The extracted text entity from the user query',
    maxLength: 100,
  })
  text: string;

  @ApiProperty({
    type: String,
    example: 'CAR_PART',
    description: 'Type/category of the extracted entity',
    enum: [
      'CAR_PART',
      'CAR_BRAND',
      'CAR_MODEL',
      'CAR_YEAR',
      'CAR_ENGINE',
      'PART_BRAND',
      'PART_NUMBER',
      'PRICE_RANGE',
      'QUANTITY',
      'CONDITION',
      'LOCATION',
      'COLOR',
      'SIZE',
    ],
  })
  type: string;

  @ApiProperty({
    type: Number,
    example: 0.95,
    description: 'Confidence score for the entity extraction accuracy',
    minimum: 0,
    maximum: 1,
  })
  confidence: number;

  @ApiProperty({
    type: Number,
    example: 7,
    description: 'Starting character index of the entity in the original text',
    minimum: 0,
  })
  startIndex: number;

  @ApiProperty({
    type: Number,
    example: 17,
    description: 'Ending character index of the entity in the original text',
    minimum: 0,
  })
  endIndex: number;

  constructor(
    text: string,
    type: string,
    confidence: number,
    startIndex: number,
    endIndex: number,
  ) {
    this.text = text;
    this.type = type;
    this.confidence = confidence;
    this.startIndex = startIndex;
    this.endIndex = endIndex;
  }

  /**
   * Get the length of the extracted entity
   */
  getLength(): number {
    return this.endIndex - this.startIndex;
  }

  /**
   * Check if this is a high confidence entity
   */
  isHighConfidence(threshold: number = 0.8): boolean {
    return this.confidence >= threshold;
  }

  /**
   * Check if this entity is related to vehicle information
   */
  isVehicleEntity(): boolean {
    const vehicleTypes = ['CAR_BRAND', 'CAR_MODEL', 'CAR_YEAR', 'CAR_ENGINE'];
    return vehicleTypes.includes(this.type);
  }

  /**
   * Check if this entity is related to parts
   */
  isPartEntity(): boolean {
    const partTypes = ['CAR_PART', 'PART_BRAND', 'PART_NUMBER'];
    return partTypes.includes(this.type);
  }

  /**
   * Check if this entity is related to commercial aspects
   */
  isCommercialEntity(): boolean {
    const commercialTypes = ['PRICE_RANGE', 'QUANTITY', 'CONDITION'];
    return commercialTypes.includes(this.type);
  }

  /**
   * Normalize the entity text (lowercase, trim)
   */
  getNormalizedText(): string {
    return this.text.toLowerCase().trim();
  }
}
