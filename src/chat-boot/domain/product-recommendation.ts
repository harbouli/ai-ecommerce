export class ProductRecommendation {
  productId: string;
  productName: string;
  description: string;
  price: number;
  imageUrl?: string;
  categoryName?: string;
  brandName?: string;
  confidence: number;
  reasoning: string;
  features?: string[];
  metadata?: Record<string, any>;

  constructor(data: Partial<ProductRecommendation>) {
    Object.assign(this, data);
  }

  isHighlyRecommended(): boolean {
    return this.confidence >= 0.8;
  }

  getFormattedPrice(): string {
    return `$${this.price.toFixed(2)}`;
  }

  hasFeatures(): boolean {
    return Boolean(this.features && this.features.length > 0);
  }

  getTopFeatures(limit: number = 3): string[] {
    return this.features?.slice(0, limit) || [];
  }
}
