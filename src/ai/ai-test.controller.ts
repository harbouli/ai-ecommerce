// src/ai/ai.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AIService } from './ai.service';
import { AnalyzeQueryDto } from './dto/analyze-query.dto';
import { ClassifyIntentDto } from './dto/intent-classification.dto';
import { ExtractEntitiesDto } from './dto/extract-entities.dto';
import { GenerateShoppingResponseDto } from './dto/generate-shopping-response.dto';

@ApiTags('AI Test')
@Controller('ai/test')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('analyze-query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test query analysis',
    description: 'Analyze user query for intent and entities',
  })
  @ApiBody({ type: AnalyzeQueryDto })
  async analyzeQuery(
    @Body(new ValidationPipe({ transform: true }))
    analyzeQueryDto: AnalyzeQueryDto,
  ) {
    return this.aiService.analyzeQuery(analyzeQueryDto.query);
  }

  @Post('classify-intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test intent classification',
    description: 'Classify user intent for car parts shopping',
  })
  @ApiBody({ type: ClassifyIntentDto })
  async classifyIntent(
    @Body(new ValidationPipe({ transform: true }))
    classifyIntentDto: ClassifyIntentDto,
  ) {
    return this.aiService.classifyIntent(classifyIntentDto.text);
  }

  @Post('extract-entities')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test entity extraction',
    description: 'Extract car parts and automotive entities from text',
  })
  @ApiBody({ type: ExtractEntitiesDto })
  async extractEntities(
    @Body(new ValidationPipe({ transform: true }))
    extractEntitiesDto: ExtractEntitiesDto,
  ) {
    return this.aiService.extractEntities(extractEntitiesDto.text);
  }

  @Post('generate-response')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test shopping response generation',
    description:
      'Generate contextual shopping response with product recommendations',
  })
  @ApiBody({ type: GenerateShoppingResponseDto })
  async generateShoppingResponse(
    @Body(new ValidationPipe({ transform: true }))
    generateResponseDto: GenerateShoppingResponseDto,
  ) {
    return this.aiService.generateShoppingResponse(
      generateResponseDto.query,
      generateResponseDto.productContext,
      generateResponseDto.userPreferences,
    );
  }
}
