export abstract class BaseGraphNode {
  id: string;
  nodeType: string;
  properties: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  constructor(nodeType: string, id?: string) {
    this.id = id || this.generateId();
    this.nodeType = nodeType;
    this.properties = {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  private generateId(): string {
    return `${this.nodeType.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setProperty(key: string, value: any): void {
    this.properties[key] = value;
    this.updatedAt = new Date();
  }

  getProperty(key: string): any {
    return this.properties[key];
  }

  toNeo4jProperties(): Record<string, any> {
    return {
      id: this.id,
      nodeType: this.nodeType,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      ...this.properties,
    };
  }
}
