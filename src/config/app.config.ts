import { registerAs } from '@nestjs/config';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import validateConfig from '../utils/validate-config';
import { AppConfig } from './app-config.type';

class GeminiConfig {
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsOptional()
  model: string;

  @IsString()
  @IsOptional()
  embeddingModel: string;

  @Transform(({ value }) => parseFloat(value))
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8192)
  maxTokens: number;

  @Transform(({ value }) => parseFloat(value))
  @IsOptional()
  @Min(0)
  @Max(1)
  topP: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  topK: number;
}

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  NODE_ENV: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  APP_PORT: number;

  @IsString()
  @IsOptional()
  APP_NAME: string;

  @IsString()
  @IsOptional()
  API_PREFIX: string;

  @IsString()
  @IsOptional()
  APP_FALLBACK_LANGUAGE: string;

  @IsString()
  @IsOptional()
  APP_HEADER_LANGUAGE: string;

  @ValidateNested()
  @Type(() => GeminiConfig)
  gemini: GeminiConfig;

  // New Gemini environment variables
  @IsString()
  @IsNotEmpty()
  GEMINI_API_KEY: string;

  @IsString()
  @IsOptional()
  GEMINI_MODEL: string;

  @IsString()
  @IsOptional()
  GEMINI_EMBEDDING_MODEL: string;

  @Transform(({ value }) => parseFloat(value))
  @IsOptional()
  @Min(0)
  @Max(2)
  GEMINI_TEMPERATURE: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8192)
  GEMINI_MAX_TOKENS: number;

  @Transform(({ value }) => parseFloat(value))
  @IsOptional()
  @Min(0)
  @Max(1)
  GEMINI_TOP_P: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  GEMINI_TOP_K: number;

  @IsString()
  @IsOptional()
  NEO4J_URI: string;

  @IsString()
  @IsOptional()
  NEO4J_USERNAME: string;

  @IsString()
  @IsOptional()
  NEO4J_PASSWORD: string;
}

export default registerAs<AppConfig>('app', () => {
  console.info('🏗️  Loading App configuration...');

  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    name: process.env.APP_NAME || 'AI E-commerce',
    workingDirectory: process.env.PWD || process.cwd(),
    frontendDomain: process.env.FRONTEND_DOMAIN,
    backendDomain: process.env.BACKEND_DOMAIN,
    port: process.env.APP_PORT
      ? parseInt(process.env.APP_PORT, 10)
      : process.env.PORT
        ? parseInt(process.env.PORT, 10)
        : 3000,
    apiPrefix: process.env.API_PREFIX || 'api',
    fallbackLanguage: process.env.APP_FALLBACK_LANGUAGE || 'en',
    headerLanguage: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password',
    },

    // Gemini configuration
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
      embeddingModel:
        process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
      temperature: process.env.GEMINI_TEMPERATURE
        ? parseFloat(process.env.GEMINI_TEMPERATURE)
        : 0.7,
      maxTokens: process.env.GEMINI_MAX_TOKENS
        ? parseInt(process.env.GEMINI_MAX_TOKENS, 10)
        : 1000,
      topP: process.env.GEMINI_TOP_P
        ? parseFloat(process.env.GEMINI_TOP_P)
        : 0.95,
      topK: process.env.GEMINI_TOP_K
        ? parseInt(process.env.GEMINI_TOP_K, 10)
        : 40,
    },
  };
});
