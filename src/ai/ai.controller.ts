import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  HttpCode,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from './ai.service';
import { CreateAiSessionDto } from './dto/create-ai-session.dto';
import { UpdateAiSessionDto } from './dto/update-ai-session.dto';
import { FindAllAiSessionsDto } from './dto/find-all-ai-sessions.dto';
import { GenerateTextDto } from './dto/generate-text.dto';
import { AnalyzeImageDto } from './dto/analyze-image.dto';
import { GenerateEmbeddingDto } from './dto/generate-embedding.dto';
import { AiSessionResponseDto } from './dto/ai-session-response.dto';
import { AiGenerationResponseDto } from './dto/ai-generation-response.dto';
import { AiAnalysisResponseDto } from './dto/ai-analysis-response.dto';
import { AiEmbeddingResponseDto } from './dto/ai-embedding-response.dto';

@ApiTags('AI')
@Controller({
  path: 'ai',
  version: '1',
})
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Create a new AI session',
    description:
      'Creates a new AI interaction session for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'AI session created successfully',
    type: AiSessionResponseDto,
  })
  async createSession(
    @Body() createAiSessionDto: CreateAiSessionDto,
    @Request() request,
  ): Promise<AiSessionResponseDto> {
    return this.aiService.createSession({
      ...createAiSessionDto,
      userId: request.user.id,
    });
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get all AI sessions',
    description:
      'Retrieves all AI sessions for the authenticated user with pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI sessions retrieved successfully',
    type: [AiSessionResponseDto],
  })
  async findAllSessions(
    @Query() query: FindAllAiSessionsDto,
    @Request() request,
  ): Promise<AiSessionResponseDto[]> {
    return this.aiService.findAllSessionsByUser(request.user.id, {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });
  }

  @Get('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get a specific AI session',
    description: 'Retrieves a specific AI session with all interactions',
  })
  @ApiParam({
    name: 'id',
    description: 'AI session ID',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI session retrieved successfully',
    type: AiSessionResponseDto,
  })
  async findOneSession(
    @Param('id') id: string,
    @Request() request,
  ): Promise<AiSessionResponseDto> {
    return this.aiService.findOneSessionByUser(id, request.user.id);
  }

  @Patch('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Update an AI session',
    description: 'Updates AI session metadata',
  })
  @ApiParam({
    name: 'id',
    description: 'AI session ID',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI session updated successfully',
    type: AiSessionResponseDto,
  })
  async updateSession(
    @Param('id') id: string,
    @Body() updateAiSessionDto: UpdateAiSessionDto,
    @Request() request,
  ): Promise<AiSessionResponseDto> {
    return this.aiService.updateSession(
      id,
      updateAiSessionDto,
      request.user.id,
    );
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Delete an AI session',
    description: 'Deletes an AI session and all its interactions',
  })
  @ApiParam({
    name: 'id',
    description: 'AI session ID',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'AI session deleted successfully',
  })
  async removeSession(
    @Param('id') id: string,
    @Request() request,
  ): Promise<void> {
    return this.aiService.removeSession(id, request.user.id);
  }

  @Post('generate/text')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Generate text using AI',
    description: 'Generates text content using various AI models',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Text generated successfully',
    type: AiGenerationResponseDto,
  })
  async generateText(
    @Body() generateTextDto: GenerateTextDto,
    @Request() request,
  ): Promise<AiGenerationResponseDto> {
    return this.aiService.generateText(generateTextDto, request.user.id);
  }

  @Post('analyze/image')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Analyze image using AI',
    description:
      'Analyzes images for content, objects, text, or other features',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Image analyzed successfully',
    type: AiAnalysisResponseDto,
  })
  async analyzeImage(
    @Body() analyzeImageDto: AnalyzeImageDto,
    @Request() request,
  ): Promise<AiAnalysisResponseDto> {
    return this.aiService.analyzeImage(analyzeImageDto, request.user.id);
  }

  @Post('embeddings/generate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Generate embeddings',
    description: 'Generates vector embeddings for text or other content',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Embeddings generated successfully',
    type: AiEmbeddingResponseDto,
  })
  async generateEmbedding(
    @Body() generateEmbeddingDto: GenerateEmbeddingDto,
    @Request() request,
  ): Promise<AiEmbeddingResponseDto> {
    return this.aiService.generateEmbedding(
      generateEmbeddingDto,
      request.user.id,
    );
  }

  @Get('usage/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get AI usage statistics',
    description: 'Retrieves AI usage statistics for the user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usage statistics retrieved successfully',
  })
  async getUsageStats(
    @Param('userId') userId: string,
    @Request() request,
  ): Promise<{
    totalRequests: number;
    tokensUsed: number;
    modelsUsed: string[];
    lastActivity: Date;
    monthlyUsage: Record<string, number>;
  }> {
    // Ensure user can only access their own stats or is admin
    if (userId !== request.user.id && !request.user.roles?.includes('admin')) {
      userId = request.user.id;
    }
    return this.aiService.getUserUsageStats(userId);
  }
}
