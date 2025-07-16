import { Module } from '@nestjs/common';
import { UsersModule } from '../../../users/users.module';

@Module({
  imports: [
    // HybridChatPersistenceModule,
    UsersModule, // Add UsersModule to imports
  ],
  //   controllers: [ChatController],
  //   providers: [ChatService],
  //   exports: [ChatService],
})
export class ChatModule {}
