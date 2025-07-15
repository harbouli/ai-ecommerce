// dto/update-ai-session.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsEnum,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum AiSessionType {
  TEXT_GENERATION = 'text_generation',
  IMAGE_ANALYSIS = 'image_analysis',
  EMBEDDINGS = 'embeddings',
  SEMANTIC_SEARCH = 'semantic_search',
  MULTIMODAL = 'multimodal',
  GENERAL = 'general',
}

export enum SessionPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export class UpdateAiSessionDto {
  @ApiPropertyOptional({
    description: 'Updated title of the AI session',
    example: 'Enhanced Product Description Generation',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated session type',
    example: AiSessionType.TEXT_GENERATION,
    enum: AiSessionType,
  })
  @IsOptional()
  @IsEnum(AiSessionType)
  sessionType?: AiSessionType;

  @ApiPropertyOptional({
    description: 'Updated context or description for the session',
    example:
      'Generating SEO-optimized product descriptions with brand guidelines compliance',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  context?: string;

  @ApiPropertyOptional({
    description: 'Updated configuration settings for the session',
    example: {
      defaultModel: 'mistral-8x7b',
      temperature: 0.8,
      maxTokens: 1500,
      systemPrompt: 'You are an expert copywriter...',
      brandGuidelines: {
        tone: 'professional',
        targetAudience: 'tech enthusiasts',
        keyFeatures: ['performance', 'quality', 'innovation'],
      },
      outputFormat: 'markdown',
      languages: ['en', 'es', 'fr'],
      qualityThreshold: 0.85,
    },
  })
  @IsOptional()
  @IsObject()
  configuration?: {
    // Model Settings
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;

    // Prompt Configuration
    systemPrompt?: string;
    userPromptTemplate?: string;

    // Brand Guidelines
    brandGuidelines?: {
      tone?: 'formal' | 'casual' | 'professional' | 'friendly' | 'technical';
      voice?: 'authoritative' | 'conversational' | 'educational' | 'persuasive';
      targetAudience?: string;
      keyFeatures?: string[];
      avoidWords?: string[];
      requiredTerms?: string[];
      brandValues?: string[];
    };

    // Output Settings
    outputFormat?: 'text' | 'json' | 'markdown' | 'html' | 'xml';
    outputStructure?: {
      sections?: string[];
      maxLength?: number;
      includeMetadata?: boolean;
    };

    // Language and Localization
    languages?: string[];
    defaultLanguage?: string;
    localizationRules?: Record<string, any>;

    // Quality Control
    qualityThreshold?: number;
    enableFactChecking?: boolean;
    plagiarismCheck?: boolean;

    // Advanced Settings
    customParameters?: Record<string, any>;
    experimentalFeatures?: string[];
    fallbackModel?: string;
    retrySettings?: {
      maxRetries?: number;
      backoffMultiplier?: number;
    };
  };

  @ApiPropertyOptional({
    description: 'Whether the session is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Session tags for organization and filtering',
    example: ['product-descriptions', 'e-commerce', 'seo', 'marketing'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Session priority level',
    example: SessionPriority.HIGH,
    enum: SessionPriority,
  })
  @IsOptional()
  @IsEnum(SessionPriority)
  priority?: SessionPriority;

  @ApiPropertyOptional({
    description: 'Additional metadata for the session',
    example: {
      department: 'marketing',
      project: 'Q1-product-launch',
      approvalRequired: true,
      estimatedCost: 25.5,
      budget: {
        allocated: 100.0,
        spent: 25.5,
        remaining: 74.5,
      },
      collaborators: ['user1@example.com', 'user2@example.com'],
      deadlines: {
        firstDraft: '2024-02-01T00:00:00.000Z',
        finalDelivery: '2024-02-15T00:00:00.000Z',
      },
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    // Project Information
    department?: string;
    project?: string;
    client?: string;
    campaign?: string;

    // Workflow
    approvalRequired?: boolean;
    approvers?: string[];
    reviewers?: string[];
    collaborators?: string[];

    // Budget and Cost Tracking
    estimatedCost?: number;
    actualCost?: number;
    budget?: {
      allocated?: number;
      spent?: number;
      remaining?: number;
      currency?: string;
    };

    // Timeline
    deadlines?: {
      firstDraft?: string;
      review?: string;
      finalDelivery?: string;
    };
    startDate?: string;
    expectedDuration?: number; // in hours

    // Quality Assurance
    qualityChecks?: {
      grammarCheck?: boolean;
      plagiarismCheck?: boolean;
      factCheck?: boolean;
      brandCompliance?: boolean;
    };

    // Performance Tracking
    kpis?: {
      targetQuality?: number;
      targetSpeed?: number;
      targetCost?: number;
    };

    // Version Control
    version?: string;
    lastModifiedBy?: string;
    changeLog?: Array<{
      timestamp: string;
      user: string;
      changes: string;
    }>;

    // Integration
    connectedTools?: string[];
    webhooks?: Array<{
      url: string;
      events: string[];
    }>;

    // Custom Fields
    [key: string]: any;
  };

  @ApiPropertyOptional({
    description: 'Session scheduling settings',
    example: {
      isScheduled: false,
      scheduledTime: '2024-02-01T09:00:00.000Z',
      timezone: 'UTC',
      recurrence: 'weekly',
    },
  })
  @IsOptional()
  @IsObject()
  scheduling?: {
    isScheduled?: boolean;
    scheduledTime?: string;
    timezone?: string;
    recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
    endDate?: string;
    maxRuns?: number;
  };

  @ApiPropertyOptional({
    description: 'Notification preferences',
    example: {
      onCompletion: true,
      onError: true,
      onBudgetAlert: true,
      recipients: ['user@example.com'],
    },
  })
  @IsOptional()
  @IsObject()
  notifications?: {
    onCompletion?: boolean;
    onError?: boolean;
    onBudgetAlert?: boolean;
    onQualityIssue?: boolean;
    recipients?: string[];
    channels?: Array<'email' | 'slack' | 'webhook'>;
  };
}
