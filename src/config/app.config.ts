import { registerAs } from '@nestjs/config';
import { AppConfig } from './app-config.type';
import validateConfig from '../utils/validate-config';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}
enum MistralModel {
  LARGE = 'mistral-large-latest',
  SMALL = 'mistral-small-latest',
  NEMO = 'open-mistral-nemo',
  MINISTRAL_8B = 'ministral-8b-latest',
  MINISTRAL_3B = 'ministral-3b-latest',
  CODESTRAL = 'codestral-latest',
}
enum EmbeddingModel {
  EMBED = 'mistral-embed',
}
class EnvironmentVariablesValidator {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment;

  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  APP_PORT: number;

  @IsUrl({ require_tld: false })
  @IsOptional()
  FRONTEND_DOMAIN: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  BACKEND_DOMAIN: string;

  @IsString()
  @IsOptional()
  API_PREFIX: string;

  @IsString()
  @IsOptional()
  APP_FALLBACK_LANGUAGE: string;

  @IsString()
  @IsOptional()
  APP_HEADER_LANGUAGE: string;

  // Neo4j configuration
  @IsString()
  @IsOptional()
  NEO4J_URI: string;

  @IsString()
  @IsOptional()
  NEO4J_USERNAME: string;

  @IsString()
  @IsOptional()
  NEO4J_PASSWORD: string;
  @IsString()
  MISTRAL_API_KEY: string;

  @IsEnum(MistralModel)
  @IsOptional()
  MISTRAL_MODEL: MistralModel;

  @IsEnum(EmbeddingModel)
  @IsOptional()
  MISTRAL_EMBEDDING_MODEL: EmbeddingModel;

  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  MISTRAL_TEMPERATURE: number;
}

export default registerAs<AppConfig>('app', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    name: process.env.APP_NAME || 'app',
    workingDirectory: process.env.PWD || process.cwd(),
    frontendDomain: process.env.FRONTEND_DOMAIN,
    backendDomain: process.env.BACKEND_DOMAIN ?? 'http://localhost',
    port: process.env.APP_PORT
      ? parseInt(process.env.APP_PORT, 10)
      : process.env.PORT
        ? parseInt(process.env.PORT, 10)
        : 3000,
    apiPrefix: process.env.API_PREFIX || 'api',
    fallbackLanguage: process.env.APP_FALLBACK_LANGUAGE || 'en',
    headerLanguage: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
    // Neo4j configuration
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password',
    },
    mistral: {
      apiKey: process.env.MISTRAL_API_KEY || '',
      model: process.env.MISTRAL_MODEL || MistralModel.LARGE,
      embeddingModel:
        process.env.MISTRAL_EMBEDDING_MODEL || EmbeddingModel.EMBED,
      temperature: process.env.MISTRAL_TEMPERATURE
        ? process.env.MISTRAL_TEMPERATURE
        : '0.7',
      maxTokens: process.env.MISTRAL_MAX_TOKENS || '1000',
    },
  };
});
