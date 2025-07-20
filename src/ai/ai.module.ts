import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AIController } from './ai-test.controller';
import { AIService } from './ai.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [
    // AIController,
    AIController,
  ],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
