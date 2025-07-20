export { IntentClassification } from './intent-classification';
export { ExtractedEntity } from './extracted-entity';
export { QueryAnalysis } from './query-analysis';
export { ShoppingResponse } from './shopping-response';

// Additional type exports for convenience
export type IntentType =
  | 'PRODUCT_SEARCH'
  | 'PRICE_INQUIRY'
  | 'COMPATIBILITY_CHECK'
  | 'RECOMMENDATION'
  | 'INSTALLATION_HELP'
  | 'WARRANTY_INQUIRY'
  | 'ORDER_STATUS'
  | 'COMPARISON'
  | 'AVAILABILITY'
  | 'GREETING'
  | 'HELP_REQUEST'
  | 'OTHER';

export type EntityType =
  | 'CAR_PART'
  | 'CAR_BRAND'
  | 'CAR_MODEL'
  | 'CAR_YEAR'
  | 'CAR_ENGINE'
  | 'PART_BRAND'
  | 'PART_NUMBER'
  | 'PRICE_RANGE'
  | 'QUANTITY'
  | 'CONDITION'
  | 'LOCATION'
  | 'COLOR'
  | 'SIZE';
export { OllamaResponse } from './ollama-response';
export { OllamaRequest } from './ollama-request';
export { OllamaRequestOptions } from './ollama-request-options';

// Ollama-specific types
export type OllamaModel =
  | 'llama2'
  | 'llama3.2:latest'
  | 'codellama'
  | 'mistral'
  | string;

export type OllamaStreamMode = 'complete' | 'streaming';

export interface OllamaHealthStatus {
  isAvailable: boolean;
  models: string[];
  version?: string;
  responseTime: number;
  lastChecked: Date;
}

export interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  format: string;
  family: string;
  families?: string[];
  parameter_size: string;
  quantization_level: string;
}
