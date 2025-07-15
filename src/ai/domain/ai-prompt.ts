import { AiModelType } from './ai-model';

export class AiPrompt {
  id?: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  modelType: AiModelType;
  variables?: Array<{
    name: string;
    type: string;
    description?: string;
    defaultValue?: any;
  }>;
  examples?: Array<{
    input: Record<string, any>;
    expectedOutput: string;
  }>;
  createdBy: string;
  isPublic: boolean;
  usageCount: number;
  rating?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(data: Partial<AiPrompt>) {
    Object.assign(this, data);
    this.createdAt = this.createdAt || new Date();
    this.updatedAt = this.updatedAt || new Date();
    this.usageCount = this.usageCount || 0;
    this.tags = this.tags || [];
  }

  interpolateVariables(variables: Record<string, any>): string {
    let interpolatedContent = this.content;

    if (this.variables) {
      this.variables.forEach((variable) => {
        const value = variables[variable.name] || variable.defaultValue || '';
        const placeholder = `{{${variable.name}}}`;
        interpolatedContent = interpolatedContent.replace(
          new RegExp(placeholder, 'g'),
          value,
        );
      });
    }

    return interpolatedContent;
  }

  incrementUsage(): void {
    this.usageCount++;
    this.updatedAt = new Date();
  }

  addTag(tag: string): void {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }

  removeTag(tag: string): void {
    const index = this.tags.indexOf(tag);
    if (index > -1) {
      this.tags.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  hasVariable(variableName: string): boolean {
    return this.variables?.some((v) => v.name === variableName) || false;
  }

  getRequiredVariables(): string[] {
    return (
      this.variables?.filter((v) => !v.defaultValue).map((v) => v.name) || []
    );
  }
}
