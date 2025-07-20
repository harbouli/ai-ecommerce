import { ApiProperty } from '@nestjs/swagger';

export class IntentClassification {
  @ApiProperty({
    type: String,
    example: 'PRODUCT_SEARCH',
    description: 'The classified intent category for the user query',
    enum: [
      'PRODUCT_SEARCH',
      'PRICE_INQUIRY',
      'COMPATIBILITY_CHECK',
      'RECOMMENDATION',
      'INSTALLATION_HELP',
      'WARRANTY_INQUIRY',
      'ORDER_STATUS',
      'COMPARISON',
      'AVAILABILITY',
      'GREETING',
      'HELP_REQUEST',
      'OTHER',
    ],
  })
  intent: string;

  @ApiProperty({
    type: Number,
    example: 0.92,
    description: 'Confidence score for the intent classification',
    minimum: 0,
    maximum: 1,
  })
  confidence: number;

  @ApiProperty({
    type: String,
    example: 'User is looking for specific car parts based on keywords',
    description: 'Brief explanation of why this intent was classified',
    maxLength: 500,
  })
  reasoning: string;

  constructor(intent: string, confidence: number, reasoning: string) {
    this.intent = intent;
    this.confidence = confidence;
    this.reasoning = reasoning;
  }

  /**
   * Check if this is a high confidence classification
   */
  isHighConfidence(threshold: number = 0.8): boolean {
    return this.confidence >= threshold;
  }

  /**
   * Check if this is a shopping-related intent
   */
  isShoppingIntent(): boolean {
    const shoppingIntents = [
      'PRODUCT_SEARCH',
      'PRICE_INQUIRY',
      'COMPATIBILITY_CHECK',
      'RECOMMENDATION',
      'COMPARISON',
      'AVAILABILITY',
    ];
    return shoppingIntents.includes(this.intent);
  }

  /**
   * Check if this intent requires product context
   */
  requiresProductContext(): boolean {
    const contextRequiredIntents = [
      'PRODUCT_SEARCH',
      'RECOMMENDATION',
      'COMPARISON',
      'COMPATIBILITY_CHECK',
    ];
    return contextRequiredIntents.includes(this.intent);
  }
}
