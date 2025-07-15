export class ProductInteraction {
  productId: string;
  interactionType:
    | 'viewed'
    | 'clicked'
    | 'added_to_cart'
    | 'purchased'
    | 'asked_about';
  timestamp: Date;
  context?: string;
  metadata?: Record<string, any>;

  constructor(data: Partial<ProductInteraction>) {
    Object.assign(this, data);
    this.timestamp = this.timestamp || new Date();
  }

  isRecent(hoursAgo: number = 24): boolean {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    return this.timestamp > cutoff;
  }

  isHighValueInteraction(): boolean {
    return ['added_to_cart', 'purchased'].includes(this.interactionType);
  }
}
