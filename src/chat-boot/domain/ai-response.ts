import { ProductRecommendationDto } from '../dto/product-recommendation.dto';

export class AiResponse {
  message: string;
  confidence: number;
  reasoning: string;
  model: string;
  productRecommendations?: ProductRecommendationDto[];
  metadata?: Record<string, any>;
  processingTimeMs?: number;

  constructor(data: Partial<AiResponse>) {
    Object.assign(this, data);
  }

  hasProductRecommendations(): boolean {
    return Boolean(
      this.productRecommendations && this.productRecommendations.length > 0,
    );
  }

  isHighConfidence(): boolean {
    return this.confidence >= 0.8;
  }

  isMediumConfidence(): boolean {
    return this.confidence >= 0.5 && this.confidence < 0.8;
  }

  isLowConfidence(): boolean {
    return this.confidence < 0.5;
  }
}
