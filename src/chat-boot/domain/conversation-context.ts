import { Message } from './chat-session';

export class ConversationContext {
  chatId: string;
  userId: string;
  recentMessages: Message[];
  userPreferences?: Record<string, any>;
  sessionData?: Record<string, any>;

  constructor(data: Partial<ConversationContext>) {
    Object.assign(this, data);
    this.recentMessages = this.recentMessages || [];
  }

  addMessage(message: Message): void {
    this.recentMessages.push(message);
    // Keep only the last 20 messages for context
    if (this.recentMessages.length > 20) {
      this.recentMessages = this.recentMessages.slice(-20);
    }
  }

  getLastUserMessage(): Message | undefined {
    return this.recentMessages.filter((msg) => msg.isFromUser()).slice(-1)[0];
  }

  getLastAssistantMessage(): Message | undefined {
    return this.recentMessages
      .filter((msg) => msg.isFromAssistant())
      .slice(-1)[0];
  }

  getConversationSummary(): string {
    return this.recentMessages
      .slice(-10)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  extractUserIntents(): string[] {
    const intents: string[] = [];

    this.recentMessages
      .filter((msg) => msg.isFromUser())
      .forEach((msg) => {
        const intent = msg.getMetadata<string>('intent');
        if (intent && !intents.includes(intent)) {
          intents.push(intent);
        }
      });

    return intents;
  }
}
