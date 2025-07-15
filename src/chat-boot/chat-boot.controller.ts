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
import { ChatBootService } from './chat-boot.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { FindAllChatsDto } from './dto/find-all-chats.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { ProductRecommendationDto } from './dto/product-recommendation.dto';
import { SemanticSearchDto } from './dto/semantic-search.dto';

@ApiTags('Chat Bot')
@Controller({
  path: 'chat-boot',
  version: '1',
})
export class ChatBootController {
  constructor(private readonly chatBootService: ChatBootService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Create a new chat session',
    description: 'Creates a new chat session for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Chat session created successfully',
    type: ChatResponseDto,
  })
  async createChat(
    @Body() createChatDto: CreateChatDto,
    @Request() request,
  ): Promise<ChatResponseDto> {
    return this.chatBootService.create({
      ...createChatDto,
      userId: request.user.id,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get all chat sessions',
    description:
      'Retrieves all chat sessions for the authenticated user with pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chat sessions retrieved successfully',
    type: [ChatResponseDto],
  })
  async findAllChats(
    @Query() query: FindAllChatsDto,
    @Request() request,
  ): Promise<ChatResponseDto[]> {
    return this.chatBootService.findAllByUser(request.user.id, {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get a specific chat session',
    description: 'Retrieves a specific chat session with all messages',
  })
  @ApiParam({
    name: 'id',
    description: 'Chat session ID',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chat session retrieved successfully',
    type: ChatResponseDto,
  })
  async findOneChat(
    @Param('id') id: string,
    @Request() request,
  ): Promise<ChatResponseDto> {
    return this.chatBootService.findOneByUser(id, request.user.id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Update a chat session',
    description: 'Updates chat session metadata (title, etc.)',
  })
  @ApiParam({
    name: 'id',
    description: 'Chat session ID',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chat session updated successfully',
    type: ChatResponseDto,
  })
  async updateChat(
    @Param('id') id: string,
    @Body() updateChatDto: UpdateChatDto,
    @Request() request,
  ): Promise<ChatResponseDto> {
    return this.chatBootService.update(id, updateChatDto, request.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Delete a chat session',
    description: 'Deletes a chat session and all its messages',
  })
  @ApiParam({
    name: 'id',
    description: 'Chat session ID',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Chat session deleted successfully',
  })
  async removeChat(@Param('id') id: string, @Request() request): Promise<void> {
    return this.chatBootService.remove(id, request.user.id);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Send a message in chat',
    description: 'Sends a message to the AI chatbot and receives a response',
  })
  @ApiParam({
    name: 'id',
    description: 'Chat session ID',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Message sent and response received successfully',
    type: MessageResponseDto,
  })
  async sendMessage(
    @Param('id') chatId: string,
    @Body() sendMessageDto: SendMessageDto,
    @Request() request,
  ): Promise<MessageResponseDto> {
    return this.chatBootService.sendMessage(
      chatId,
      sendMessageDto,
      request.user.id,
    );
  }

  @Get(':id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get chat messages',
    description: 'Retrieves all messages in a chat session with pagination',
  })
  @ApiParam({
    name: 'id',
    description: 'Chat session ID',
    type: 'string',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Messages retrieved successfully',
    type: [MessageResponseDto],
  })
  async getChatMessages(
    @Param('id') chatId: string,
    @Query() query: FindAllChatsDto,
    @Request() request,
  ): Promise<MessageResponseDto[]> {
    return this.chatBootService.getChatMessages(chatId, request.user.id, {
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Post('recommendations')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get AI product recommendations',
    description:
      'Get personalized product recommendations based on user preferences and chat history',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product recommendations generated successfully',
    type: [ProductRecommendationDto],
  })
  async getRecommendations(
    @Request() request,
    @Body() body?: { context?: string; limit?: number },
  ): Promise<ProductRecommendationDto[]> {
    return this.chatBootService.getPersonalizedRecommendations(
      request.user.id,
      body?.context,
      body?.limit ?? 10,
    );
  }

  @Post('search/semantic')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'AI-powered semantic search',
    description:
      'Search products using natural language through the knowledge graph',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Semantic search completed successfully',
    type: [ProductRecommendationDto],
  })
  async semanticSearch(
    @Body() semanticSearchDto: SemanticSearchDto,
    @Request() request,
  ): Promise<ProductRecommendationDto[]> {
    return this.chatBootService.semanticSearch(
      semanticSearchDto.query,
      request.user.id,
      semanticSearchDto.limit ?? 10,
      semanticSearchDto.threshold ?? 0.7,
    );
  }

  @Get('health/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health check',
    description: 'Check the health of chat bot services and dependencies',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Health check completed',
  })
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    services: {
      neo4j: boolean;
      mistralAi: boolean;
      vectorStore: boolean;
    };
  }> {
    return this.chatBootService.healthCheck();
  }
}
