# Chat System Architecture: Domains, Entities & Methods

## Domain Entities

### 1. **Chat Domain**

```typescript
// src/chat/domain/chat.ts
export class Chat {
  id: string;
  userId: string;
  sessionId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

### 2. **Message Domain**

```typescript
// src/chat/domain/message.ts
export class Message {
  id: string;
  chatId: string;
  type: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  metadata?: MessageMetadata;
  timestamp: Date;
  context?: MessageContext[];
  entities?: ExtractedEntity[];
  intent?: string;
  confidence?: number;
}

export class MessageMetadata {
  processingTime: number;
  tokensUsed: number;
  model: string;
  temperature: number;
}

export class MessageContext {
  source: 'VECTOR' | 'GRAPH' | 'DOCUMENT';
  content: string;
  score: number;
  metadata: Record<string, any>;
}

export class ExtractedEntity {
  text: string;
  type: 'PRODUCT' | 'CATEGORY' | 'BRAND' | 'PRICE' | 'FEATURE';
  confidence: number;
  metadata: Record<string, any>;
}
```

### 3. **Conversation Domain**

```typescript
// src/chat/domain/conversation.ts
export class Conversation {
  id: string;
  userId: string;
  sessionId: string;
  context: ConversationContext;
  summary?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  createdAt: Date;
  updatedAt: Date;
}

export class ConversationContext {
  userProfile: UserProfile;
  currentIntent: string;
  extractedEntities: ExtractedEntity[];
  conversationHistory: ConversationTurn[];
  recommendations: ProductRecommendation[];
}

export class ConversationTurn {
  userMessage: string;
  assistantResponse: string;
  timestamp: Date;
  context: MessageContext[];
}
```

### 4. **Knowledge Domain**

```typescript
// src/chat/domain/knowledge.ts
export class KnowledgeEntity {
  id: string;
  type: 'PRODUCT' | 'CATEGORY' | 'BRAND' | 'FEATURE' | 'CUSTOMER' | 'CONCEPT';
  name: string;
  description: string;
  properties: Record<string, any>;
  vector?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export class KnowledgeRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type:
    | 'BELONGS_TO'
    | 'SIMILAR_TO'
    | 'PURCHASED_WITH'
    | 'RECOMMENDED_FOR'
    | 'RELATED_TO';
  weight: number;
  properties: Record<string, any>;
  createdAt: Date;
}
```

### 5. **Intent Domain**

```typescript
// src/chat/domain/intent.ts
export class Intent {
  id: string;
  name: string;
  description: string;
  examples: string[];
  entities: string[];
  responses: IntentResponse[];
  confidence: number;
}

export class IntentResponse {
  template: string;
  parameters: string[];
  actions: string[];
}
```

---

## Repository Interfaces (Ports)

### 1. **Chat Repository Port**

```typescript
// src/chat/infrastructure/persistence/chat.repository.ts
export abstract class ChatRepository {
  abstract create(data: Omit<Chat, 'id'>): Promise<Chat>;
  abstract findById(id: Chat['id']): Promise<NullableType<Chat>>;
  abstract findByUserId(userId: string): Promise<Chat[]>;
  abstract findBySessionId(sessionId: string): Promise<NullableType<Chat>>;
  abstract update(id: Chat['id'], payload: Partial<Chat>): Promise<Chat | null>;
  abstract remove(id: Chat['id']): Promise<void>;
  abstract findActiveByUserId(userId: string): Promise<Chat[]>;
  abstract markAsCompleted(id: Chat['id']): Promise<Chat | null>;
}
```

### 2. **Message Repository Port**

```typescript
// src/chat/infrastructure/persistence/message.repository.ts
export abstract class MessageRepository {
  abstract create(data: Omit<Message, 'id'>): Promise<Message>;
  abstract findById(id: Message['id']): Promise<NullableType<Message>>;
  abstract findByChatId(chatId: string): Promise<Message[]>;
  abstract findBySessionId(sessionId: string): Promise<Message[]>;
  abstract update(
    id: Message['id'],
    payload: Partial<Message>,
  ): Promise<Message | null>;
  abstract remove(id: Message['id']): Promise<void>;
  abstract findRecentByUserId(
    userId: string,
    limit: number,
  ): Promise<Message[]>;
  abstract findByEntityType(entityType: string): Promise<Message[]>;
  abstract findByIntent(intent: string): Promise<Message[]>;
}
```

### 3. **Knowledge Repository Port**

```typescript
// src/chat/infrastructure/persistence/knowledge.repository.ts
export abstract class KnowledgeRepository {
  abstract create(data: Omit<KnowledgeEntity, 'id'>): Promise<KnowledgeEntity>;
  abstract findById(
    id: KnowledgeEntity['id'],
  ): Promise<NullableType<KnowledgeEntity>>;
  abstract findByType(type: string): Promise<KnowledgeEntity[]>;
  abstract findByName(name: string): Promise<KnowledgeEntity[]>;
  abstract update(
    id: KnowledgeEntity['id'],
    payload: Partial<KnowledgeEntity>,
  ): Promise<KnowledgeEntity | null>;
  abstract remove(id: KnowledgeEntity['id']): Promise<void>;
  abstract findSimilar(
    vector: number[],
    limit: number,
  ): Promise<KnowledgeEntity[]>;
  abstract findByProperties(
    properties: Record<string, any>,
  ): Promise<KnowledgeEntity[]>;
}
```

---

## MongoDB Repositories (Document Adapters)

### 1. **Chat Document Repository**

```typescript
// src/chat/infrastructure/persistence/document/repositories/chat.repository.ts
export class ChatDocumentRepository implements ChatRepository {
  constructor(
    @InjectModel(ChatSchemaClass.name)
    private chatModel: Model<ChatSchemaClass>,
  ) {}

  async create(data: Omit<Chat, 'id'>): Promise<Chat>;
  async findById(id: Chat['id']): Promise<NullableType<Chat>>;
  async findByUserId(userId: string): Promise<Chat[]>;
  async findBySessionId(sessionId: string): Promise<NullableType<Chat>>;
  async update(id: Chat['id'], payload: Partial<Chat>): Promise<Chat | null>;
  async remove(id: Chat['id']): Promise<void>;
  async findActiveByUserId(userId: string): Promise<Chat[]>;
  async markAsCompleted(id: Chat['id']): Promise<Chat | null>;
  async findWithPagination(options: IPaginationOptions): Promise<Chat[]>;
  async countByUserId(userId: string): Promise<number>;
}
```

### 2. **Message Document Repository**

```typescript
// src/chat/infrastructure/persistence/document/repositories/message.repository.ts
export class MessageDocumentRepository implements MessageRepository {
  constructor(
    @InjectModel(MessageSchemaClass.name)
    private messageModel: Model<MessageSchemaClass>,
  ) {}

  async create(data: Omit<Message, 'id'>): Promise<Message>;
  async findById(id: Message['id']): Promise<NullableType<Message>>;
  async findByChatId(chatId: string): Promise<Message[]>;
  async findBySessionId(sessionId: string): Promise<Message[]>;
  async update(
    id: Message['id'],
    payload: Partial<Message>,
  ): Promise<Message | null>;
  async remove(id: Message['id']): Promise<void>;
  async findRecentByUserId(userId: string, limit: number): Promise<Message[]>;
  async findByEntityType(entityType: string): Promise<Message[]>;
  async findByIntent(intent: string): Promise<Message[]>;
  async findByDateRange(startDate: Date, endDate: Date): Promise<Message[]>;
  async aggregateByIntent(): Promise<any[]>;
  async findConversationHistory(
    sessionId: string,
    limit: number,
  ): Promise<Message[]>;
}
```

---

## Weaviate Repositories (Vector Adapters)

### 1. **Chat Vector Repository**

```typescript
// src/chat/infrastructure/persistence/weaviate/repositories/chat-vector.repository.ts
export class ChatVectorRepository {
  constructor(private weaviateService: WeaviateService) {}

  async storeMessageVector(message: Message): Promise<void>;
  async storeConversationContext(context: ConversationContext): Promise<void>;
  async semanticSearch(
    query: string,
    limit: number,
    threshold: number,
  ): Promise<MessageContext[]>;
  async findSimilarMessages(
    messageId: string,
    limit: number,
  ): Promise<Message[]>;
  async findRelevantContext(
    entities: ExtractedEntity[],
    limit: number,
  ): Promise<MessageContext[]>;
  async updateMessageVector(messageId: string, vector: number[]): Promise<void>;
  async deleteMessageVector(messageId: string): Promise<void>;
  async findContextByIntent(
    intent: string,
    limit: number,
  ): Promise<MessageContext[]>;
  async hybridSearch(
    query: string,
    filters: Record<string, any>,
    limit: number,
  ): Promise<MessageContext[]>;
}
```

### 2. **Knowledge Vector Repository**

```typescript
// src/chat/infrastructure/persistence/weaviate/repositories/knowledge-vector.repository.ts
export class KnowledgeVectorRepository {
  constructor(private weaviateService: WeaviateService) {}

  async storeKnowledgeVector(knowledge: KnowledgeEntity): Promise<void>;
  async findSimilarKnowledge(
    vector: number[],
    limit: number,
  ): Promise<KnowledgeEntity[]>;
  async semanticKnowledgeSearch(
    query: string,
    limit: number,
  ): Promise<KnowledgeEntity[]>;
  async findKnowledgeByType(
    type: string,
    query: string,
    limit: number,
  ): Promise<KnowledgeEntity[]>;
  async updateKnowledgeVector(id: string, vector: number[]): Promise<void>;
  async deleteKnowledgeVector(id: string): Promise<void>;
  async findRelatedConcepts(
    entityId: string,
    limit: number,
  ): Promise<KnowledgeEntity[]>;
  async hybridKnowledgeSearch(
    query: string,
    filters: Record<string, any>,
  ): Promise<KnowledgeEntity[]>;
}
```

---

## Neo4j Repositories (Graph Adapters)

### 1. **Chat Graph Repository**

```typescript
// src/chat/infrastructure/persistence/graph/repositories/chat-graph.repository.ts
export class ChatGraphRepository {
  constructor(private neo4jService: Neo4jService) {}

  async createUserChatRelationship(
    userId: string,
    chatId: string,
  ): Promise<void>;
  async createMessageFlow(
    fromMessageId: string,
    toMessageId: string,
  ): Promise<void>;
  async findUserChatHistory(userId: string, limit: number): Promise<any[]>;
  async findConversationPath(sessionId: string): Promise<any[]>;
  async createIntentTransition(
    fromIntent: string,
    toIntent: string,
  ): Promise<void>;
  async findIntentFlow(userId: string): Promise<any[]>;
  async findSimilarConversations(chatId: string, limit: number): Promise<any[]>;
  async updateConversationMetrics(
    sessionId: string,
    metrics: Record<string, any>,
  ): Promise<void>;
  async findUserBehaviorPatterns(userId: string): Promise<any[]>;
  async createEntityMentionRelationship(
    messageId: string,
    entityId: string,
  ): Promise<void>;
}
```

### 2. **Knowledge Graph Repository**

```typescript
// src/chat/infrastructure/persistence/graph/repositories/knowledge-graph.repository.ts
export class KnowledgeGraphRepository {
  constructor(private neo4jService: Neo4jService) {}

  async createKnowledgeEntity(entity: KnowledgeEntity): Promise<void>;
  async createKnowledgeRelationship(
    relationship: KnowledgeRelationship,
  ): Promise<void>;
  async findRelatedEntities(
    entityId: string,
    hops: number,
  ): Promise<KnowledgeEntity[]>;
  async findEntityRelationships(
    entityId: string,
  ): Promise<KnowledgeRelationship[]>;
  async findShortestPath(
    fromEntityId: string,
    toEntityId: string,
  ): Promise<any[]>;
  async findEntitiesByType(type: string): Promise<KnowledgeEntity[]>;
  async updateEntityProperties(
    entityId: string,
    properties: Record<string, any>,
  ): Promise<void>;
  async deleteEntity(entityId: string): Promise<void>;
  async findEntityClusters(entityType: string): Promise<any[]>;
  async createProductRecommendationPath(
    userId: string,
    productId: string,
    reason: string,
  ): Promise<void>;
  async findRecommendationReasons(
    userId: string,
    productId: string,
  ): Promise<string[]>;
  async updateRelationshipWeight(
    relationshipId: string,
    weight: number,
  ): Promise<void>;
}
```

---

## Hybrid Repositories (Combining All Databases)

### 1. **Hybrid Chat Repository**

```typescript
// src/chat/infrastructure/persistence/hybrid/hybrid-chat.repository.ts
export class HybridChatRepository implements ChatRepository {
  constructor(
    private mongoRepository: ChatDocumentRepository,
    private vectorRepository: ChatVectorRepository,
    private graphRepository: ChatGraphRepository,
  ) {}

  async create(data: Omit<Chat, 'id'>): Promise<Chat>;
  async findById(id: Chat['id']): Promise<NullableType<Chat>>;
  async findByUserId(userId: string): Promise<Chat[]>;
  async findBySessionId(sessionId: string): Promise<NullableType<Chat>>;
  async update(id: Chat['id'], payload: Partial<Chat>): Promise<Chat | null>;
  async remove(id: Chat['id']): Promise<void>;
  async findActiveByUserId(userId: string): Promise<Chat[]>;
  async markAsCompleted(id: Chat['id']): Promise<Chat | null>;

  // Hybrid-specific methods
  async findSimilarChats(chatId: string, limit: number): Promise<Chat[]>;
  async getConversationInsights(sessionId: string): Promise<any>;
  async findRecommendedTopics(userId: string): Promise<string[]>;
  async getContextualSuggestions(sessionId: string): Promise<string[]>;
}
```

### 2. **Hybrid Message Repository**

```typescript
// src/chat/infrastructure/persistence/hybrid/hybrid-message.repository.ts
export class HybridMessageRepository implements MessageRepository {
  constructor(
    private mongoRepository: MessageDocumentRepository,
    private vectorRepository: ChatVectorRepository,
    private graphRepository: ChatGraphRepository,
  ) {}

  async create(data: Omit<Message, 'id'>): Promise<Message>;
  async findById(id: Message['id']): Promise<NullableType<Message>>;
  async findByChatId(chatId: string): Promise<Message[]>;
  async findBySessionId(sessionId: string): Promise<Message[]>;
  async update(
    id: Message['id'],
    payload: Partial<Message>,
  ): Promise<Message | null>;
  async remove(id: Message['id']): Promise<void>;
  async findRecentByUserId(userId: string, limit: number): Promise<Message[]>;
  async findByEntityType(entityType: string): Promise<Message[]>;
  async findByIntent(intent: string): Promise<Message[]>;

  // Hybrid-specific methods
  async semanticMessageSearch(query: string, limit: number): Promise<Message[]>;
  async findContextualMessages(
    sessionId: string,
    query: string,
  ): Promise<Message[]>;
  async getMessageWithContext(
    messageId: string,
  ): Promise<Message & { context: MessageContext[] }>;
  async findSimilarConversations(messageId: string): Promise<Message[]>;
  async getConversationFlow(sessionId: string): Promise<any[]>;
}
```

### 3. **Hybrid Knowledge Repository**

```typescript
// src/chat/infrastructure/persistence/hybrid/hybrid-knowledge.repository.ts
export class HybridKnowledgeRepository implements KnowledgeRepository {
  constructor(
    private mongoRepository: KnowledgeDocumentRepository,
    private vectorRepository: KnowledgeVectorRepository,
    private graphRepository: KnowledgeGraphRepository,
  ) {}

  async create(data: Omit<KnowledgeEntity, 'id'>): Promise<KnowledgeEntity>;
  async findById(
    id: KnowledgeEntity['id'],
  ): Promise<NullableType<KnowledgeEntity>>;
  async findByType(type: string): Promise<KnowledgeEntity[]>;
  async findByName(name: string): Promise<KnowledgeEntity[]>;
  async update(
    id: KnowledgeEntity['id'],
    payload: Partial<KnowledgeEntity>,
  ): Promise<KnowledgeEntity | null>;
  async remove(id: KnowledgeEntity['id']): Promise<void>;
  async findSimilar(
    vector: number[],
    limit: number,
  ): Promise<KnowledgeEntity[]>;
  async findByProperties(
    properties: Record<string, any>,
  ): Promise<KnowledgeEntity[]>;

  // Hybrid-specific methods
  async semanticKnowledgeSearch(
    query: string,
    limit: number,
  ): Promise<KnowledgeEntity[]>;
  async findRelatedKnowledge(
    entityId: string,
    hops: number,
  ): Promise<KnowledgeEntity[]>;
  async getKnowledgeGraph(entityId: string): Promise<any>;
  async hybridKnowledgeSearch(
    query: string,
    filters: Record<string, any>,
  ): Promise<KnowledgeEntity[]>;
  async findKnowledgePath(
    fromEntityId: string,
    toEntityId: string,
  ): Promise<any[]>;
  async getEntityRecommendations(
    entityId: string,
    limit: number,
  ): Promise<KnowledgeEntity[]>;
}
```

---

## Service Layer Methods

### 1. **Chat Service**

```typescript
// src/chat/chat.service.ts
export class ChatService {
  async createChat(userId: string, title?: string): Promise<Chat>;
  async sendMessage(chatId: string, content: string): Promise<Message>;
  async getChatHistory(chatId: string): Promise<Message[]>;
  async getActiveChats(userId: string): Promise<Chat[]>;
  async endChat(chatId: string): Promise<Chat>;
  async deleteChat(chatId: string): Promise<void>;
  async generateSuggestions(chatId: string): Promise<string[]>;
  async getChatAnalytics(chatId: string): Promise<any>;
}
```

### 2. **KAG Service**

```typescript
// src/chat/services/kag.service.ts
export class KagService {
  async enhanceQueryWithKnowledge(
    query: string,
    entities: ExtractedEntity[],
  ): Promise<string>;
  async buildKnowledgeContext(
    entities: ExtractedEntity[],
  ): Promise<KnowledgeEntity[]>;
  async updateKnowledgeGraph(message: Message): Promise<void>;
  async findKnowledgeRecommendations(
    userId: string,
    entities: ExtractedEntity[],
  ): Promise<KnowledgeEntity[]>;
  async getContextualKnowledge(
    sessionId: string,
    query: string,
  ): Promise<KnowledgeEntity[]>;
}
```

### 3. **RAG Service**

```typescript
// src/chat/services/rag.service.ts
export class RagService {
  async retrieveRelevantContext(
    query: string,
    limit: number,
  ): Promise<MessageContext[]>;
  async augmentQueryWithContext(
    query: string,
    context: MessageContext[],
  ): Promise<string>;
  async storeConversationContext(message: Message): Promise<void>;
  async findSimilarConversations(
    query: string,
    limit: number,
  ): Promise<Message[]>;
  async getPersonalizedContext(
    userId: string,
    query: string,
  ): Promise<MessageContext[]>;
}
```

This architecture provides a comprehensive foundation for your KAG-RAG hybrid chatbot system, leveraging the strengths of each database:

- **MongoDB**: Fast document storage and retrieval for chat history and user data
- **Weaviate**: Vector search for semantic similarity and contextual understanding
- **Neo4j**: Graph relationships for knowledge discovery and recommendation paths

Each layer is properly separated according to hexagonal architecture principles, making the system maintainable and extensible.
