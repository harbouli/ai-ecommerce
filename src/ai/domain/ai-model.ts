export enum AiModelType {
  TEXT_GENERATION = 'text_generation',
  IMAGE_ANALYSIS = 'image_analysis',
  EMBEDDING = 'embedding',
  MULTIMODAL = 'multimodal',
}

export enum AiModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  MISTRAL = 'mistral',
  GOOGLE = 'google',
  HUGGING_FACE = 'hugging_face',
  LOCAL = 'local',
}

export class AiModel {
  id: string;
  name: string;
  provider: AiModelProvider;
  type: AiModelType;
  description?: string;
  capabilities: string[];
  limitations?: string[];
  pricing?: {
    inputTokens?: number;
    outputTokens?: number;
    requests?: number;
    unit: string;
  };
  configuration?: {
    maxTokens?: number;
    temperatureRange?: { min: number; max: number };
    supportedFormats?: string[];
    [key: string]: any;
  };
  isAvailable: boolean;
  version?: string;

  constructor(data: Partial<AiModel>) {
    Object.assign(this, data);
  }

  supportsCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }

  isTextModel(): boolean {
    return this.type === AiModelType.TEXT_GENERATION;
  }

  isImageModel(): boolean {
    return this.type === AiModelType.IMAGE_ANALYSIS;
  }

  isEmbeddingModel(): boolean {
    return this.type === AiModelType.EMBEDDING;
  }

  isMultimodalModel(): boolean {
    return this.type === AiModelType.MULTIMODAL;
  }

  getMaxTokens(): number | undefined {
    return this.configuration?.maxTokens;
  }

  getTemperatureRange(): { min: number; max: number } | undefined {
    return this.configuration?.temperatureRange;
  }
}
