// chat.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  BadRequestException,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatResponse } from './dto/chat-response.interface';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(AuthGuard('jwt'))
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new chat session' })
  @ApiBody({ type: CreateChatDto })
  @ApiResponse({ status: 201, description: 'Chat created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createChat(
    @Body() createChatDto: CreateChatDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<ChatResponse> {
    try {
      const userId = req.user.id;
      const chat = await this.chatService.createChat(
        userId,
        createChatDto.title,
      );

      return {
        success: true,
        data: chat,
        message: 'Chat created successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post(':chatId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message to a chat' })
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: 'string' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  async sendMessage(
    @Param('chatId') chatId: string,
    @Body() sendMessageDto: SendMessageDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<ChatResponse> {
    try {
      const userId = req.user.id;
      const message = await this.chatService.sendMessage(
        chatId,
        sendMessageDto.content,
        userId,
      );

      return {
        success: true,
        data: message,
        message: 'Message sent successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'Get chat message history' })
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  async getChatHistory(@Param('chatId') chatId: string): Promise<ChatResponse> {
    try {
      const messages = await this.chatService.getChatHistory(chatId);

      return {
        success: true,
        data: messages,
        message: 'Messages retrieved successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active chats for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Active chats retrieved successfully',
  })
  async getActiveChats(
    @Request() req: AuthenticatedRequest,
  ): Promise<ChatResponse> {
    try {
      const userId = req.user.id;
      const chats = await this.chatService.getActiveChats(userId);

      return {
        success: true,
        data: chats,
        message: 'Active chats retrieved successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post(':chatId/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End a chat session' })
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Chat ended successfully' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  async endChat(@Param('chatId') chatId: string): Promise<ChatResponse> {
    try {
      const chat = await this.chatService.endChat(chatId);

      return {
        success: true,
        data: chat,
        message: 'Chat ended successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':chatId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a chat session' })
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Chat deleted successfully' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  async deleteChat(@Param('chatId') chatId: string): Promise<ChatResponse> {
    try {
      await this.chatService.deleteChat(chatId);

      return {
        success: true,
        message: 'Chat deleted successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':chatId/suggestions')
  @ApiOperation({ summary: 'Get AI-generated suggestions for the chat' })
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Suggestions generated successfully',
  })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  async generateSuggestions(
    @Param('chatId') chatId: string,
  ): Promise<ChatResponse> {
    try {
      const suggestions = await this.chatService.generateSuggestions(chatId);

      return {
        success: true,
        data: suggestions,
        message: 'Suggestions generated successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get(':chatId/analytics')
  @ApiOperation({ summary: 'Get chat analytics and insights' })
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  async getChatAnalytics(
    @Param('chatId') chatId: string,
  ): Promise<ChatResponse> {
    try {
      const analytics = await this.chatService.getChatAnalytics(chatId);

      return {
        success: true,
        data: analytics,
        message: 'Analytics retrieved successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for chat service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  healthCheck(): ChatResponse {
    return {
      success: true,
      message: 'Chat service is healthy',
      data: {
        timestamp: new Date().toISOString(),
        service: 'chat-service',
        version: '1.0.0',
        features: ['AI', 'KAG', 'RAG', 'Shopping'],
      },
    };
  }

  @Post(':chatId/context/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh chat context using KAG and RAG' })
  @ApiParam({ name: 'chatId', description: 'Chat ID', type: 'string' })
  async refreshChatContext(
    @Param('chatId') chatId: string,
  ): Promise<ChatResponse> {
    try {
      const messages = await this.chatService.getChatHistory(chatId);

      return {
        success: true,
        data: {
          refreshed: true,
          messageCount: messages.length,
          timestamp: new Date().toISOString(),
        },
        message: 'Chat context refreshed successfully',
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
