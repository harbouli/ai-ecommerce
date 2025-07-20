import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShoppingResponse {
  @ApiProperty({
    type: String,
    example:
      'Based on your Honda Civic 2018, I recommend these brake pads that are specifically designed for your vehicle...',
    description: 'Generated response content for the shopping query',
    maxLength: 2000,
  })
  content: string;

  @ApiProperty({
    type: Number,
    example: 0.92,
    description: 'Confidence score for the response quality and relevance',
    minimum: 0,
    maximum: 1,
  })
  confidence: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['product_123', 'product_456', 'product_789'],
    description: 'List of product IDs referenced in the response',
    isArray: true,
  })
  referencedProducts?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: [
      'What year is your Honda Civic?',
      'Do you prefer ceramic or semi-metallic brake pads?',
      'Would you like to see installation instructions?',
    ],
    description: 'Follow-up suggestions to help the customer',
    isArray: true,
    maxItems: 5,
  })
  suggestions?: string[];

  constructor(
    content: string,
    confidence: number,
    referencedProducts?: string[],
    suggestions?: string[],
  ) {
    this.content = content;
    this.confidence = confidence;
    this.referencedProducts = referencedProducts || [];
    this.suggestions = suggestions || [];
  }

  /**
   * Check if this is a high confidence response
   */
  isHighConfidence(threshold: number = 0.8): boolean {
    return this.confidence >= threshold;
  }

  /**
   * Check if response includes product recommendations
   */
  hasProductRecommendations(): boolean {
    return (
      this.referencedProducts !== undefined &&
      this.referencedProducts.length > 0
    );
  }

  /**
   * Check if response includes follow-up suggestions
   */
  hasSuggestions(): boolean {
    return this.suggestions !== undefined && this.suggestions.length > 0;
  }

  /**
   * Get the number of referenced products
   */
  getProductCount(): number {
    return this.referencedProducts?.length || 0;
  }

  /**
   * Get the number of suggestions
   */
  getSuggestionCount(): number {
    return this.suggestions?.length || 0;
  }

  /**
   * Add a product reference
   */
  addProductReference(productId: string): void {
    if (!this.referencedProducts) {
      this.referencedProducts = [];
    }
    if (!this.referencedProducts.includes(productId)) {
      this.referencedProducts.push(productId);
    }
  }

  /**
   * Add a suggestion
   */
  addSuggestion(suggestion: string): void {
    if (!this.suggestions) {
      this.suggestions = [];
    }
    if (!this.suggestions.includes(suggestion) && this.suggestions.length < 5) {
      this.suggestions.push(suggestion);
    }
  }

  /**
   * Check if the response is personalized (has specific product recommendations)
   */
  isPersonalized(): boolean {
    return this.hasProductRecommendations() && this.confidence > 0.7;
  }

  /**
   * Get response summary
   */
  getSummary(): {
    contentLength: number;
    confidence: number;
    productCount: number;
    suggestionCount: number;
    isHighQuality: boolean;
  } {
    return {
      contentLength: this.content.length,
      confidence: this.confidence,
      productCount: this.getProductCount(),
      suggestionCount: this.getSuggestionCount(),
      isHighQuality: this.isHighConfidence() && this.content.length > 50,
    };
  }

  /**
   * Validate the response quality
   */
  validate(): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!this.content || this.content.trim().length === 0) {
      errors.push('Content cannot be empty');
    }

    if (this.content && this.content.length > 2000) {
      errors.push('Content exceeds maximum length of 2000 characters');
    }

    if (this.confidence < 0 || this.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
    }

    if (this.suggestions && this.suggestions.length > 5) {
      errors.push('Maximum 5 suggestions allowed');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
