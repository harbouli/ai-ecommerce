import { RelationshipType } from './relationship-types';

export abstract class BaseRelationship {
  id: string;
  type: RelationshipType;
  fromNodeId: string;
  toNodeId: string;
  fromNodeType: string;
  toNodeType: string;
  properties: Record<string, any>;
  weight: number;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    type: RelationshipType,
    fromNodeId: string,
    toNodeId: string,
    fromNodeType: string,
    toNodeType: string,
    properties: Record<string, any> = {},
    weight: number = 1.0,
    confidence: number = 1.0,
  ) {
    this.id = this.generateId();
    this.type = type;
    this.fromNodeId = fromNodeId;
    this.toNodeId = toNodeId;
    this.fromNodeType = fromNodeType;
    this.toNodeType = toNodeType;
    this.properties = properties;
    this.weight = weight;
    this.confidence = confidence;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  private generateId(): string {
    return `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setProperty(key: string, value: any): void {
    this.properties[key] = value;
    this.updatedAt = new Date();
  }

  getProperty(key: string): any {
    return this.properties[key];
  }

  updateWeight(newWeight: number): void {
    this.weight = Math.max(0, Math.min(1, newWeight));
    this.updatedAt = new Date();
  }

  updateConfidence(newConfidence: number): void {
    this.confidence = Math.max(0, Math.min(1, newConfidence));
    this.updatedAt = new Date();
  }

  toNeo4jProperties(): Record<string, any> {
    return {
      id: this.id,
      type: this.type,
      fromNodeId: this.fromNodeId,
      toNodeId: this.toNodeId,
      fromNodeType: this.fromNodeType,
      toNodeType: this.toNodeType,
      weight: this.weight,
      confidence: this.confidence,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      ...this.properties,
    };
  }
}
