import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from '../../../../../database/neo4j/neo4j.service';

@Injectable()
export class ChatGraphRepository {
  private readonly logger = new Logger(ChatGraphRepository.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  async createUserChatRelationship(
    userId: string,
    chatId: string,
  ): Promise<void> {
    const query = `
      MERGE (u:User {id: $userId})
      MERGE (c:Chat {id: $chatId})
      MERGE (u)-[r:OWNS_CHAT]->(c)
      SET r.createdAt = datetime()
      RETURN r
    `;

    try {
      await this.neo4jService.write(query, { userId, chatId });
      this.logger.log(`Created user-chat relationship: ${userId} -> ${chatId}`);
    } catch (error) {
      this.logger.error('Error creating user-chat relationship:', error);
      throw error;
    }
  }

  async createMessageFlow(
    fromMessageId: string,
    toMessageId: string,
  ): Promise<void> {
    const query = `
      MERGE (m1:Message {id: $fromMessageId})
      MERGE (m2:Message {id: $toMessageId})
      MERGE (m1)-[r:FOLLOWED_BY]->(m2)
      SET r.createdAt = datetime()
      RETURN r
    `;

    try {
      await this.neo4jService.write(query, { fromMessageId, toMessageId });
      this.logger.log(
        `Created message flow: ${fromMessageId} -> ${toMessageId}`,
      );
    } catch (error) {
      this.logger.error('Error creating message flow:', error);
      throw error;
    }
  }

  async findUserChatHistory(userId: string, limit: number): Promise<any[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:OWNS_CHAT]->(c:Chat)
      OPTIONAL MATCH (c)-[:CONTAINS_MESSAGE]->(m:Message)
      WITH c, COUNT(m) as messageCount, MAX(m.timestamp) as lastActivity
      ORDER BY lastActivity DESC
      LIMIT $limit
      RETURN c.id as chatId, c.title as title, c.status as status, 
             messageCount, lastActivity, c.createdAt as createdAt
    `;

    try {
      const result = await this.neo4jService.read(query, { userId, limit });
      return result.records.map((record) => ({
        chatId: record.get('chatId'),
        title: record.get('title'),
        status: record.get('status'),
        messageCount: record.get('messageCount').toNumber(),
        lastActivity: record.get('lastActivity'),
        createdAt: record.get('createdAt'),
      }));
    } catch (error) {
      this.logger.error('Error finding user chat history:', error);
      return [];
    }
  }

  async findConversationPath(sessionId: string): Promise<any[]> {
    const query = `
      MATCH (s:Session {id: $sessionId})-[:CONTAINS_MESSAGE]->(m:Message)
      MATCH path = (m)-[:FOLLOWED_BY*0..]->(next:Message)
      WHERE (next)-[:FOLLOWED_BY]->() OR NOT (next)-[:FOLLOWED_BY]->()
      WITH path, LENGTH(path) as pathLength
      ORDER BY pathLength DESC
      LIMIT 1
      UNWIND nodes(path) as message
      RETURN message.id as messageId, message.type as type, 
             message.content as content, message.intent as intent,
             message.timestamp as timestamp, message.confidence as confidence
      ORDER BY message.timestamp ASC
    `;

    try {
      const result = await this.neo4jService.read(query, { sessionId });
      return result.records.map((record) => ({
        messageId: record.get('messageId'),
        type: record.get('type'),
        content: record.get('content'),
        intent: record.get('intent'),
        timestamp: record.get('timestamp'),
        confidence: record.get('confidence'),
      }));
    } catch (error) {
      this.logger.error('Error finding conversation path:', error);
      return [];
    }
  }

  async createIntentTransition(
    fromIntent: string,
    toIntent: string,
  ): Promise<void> {
    const query = `
      MERGE (i1:Intent {name: $fromIntent})
      MERGE (i2:Intent {name: $toIntent})
      MERGE (i1)-[r:TRANSITIONS_TO]->(i2)
      SET r.count = COALESCE(r.count, 0) + 1,
          r.lastTransition = datetime()
      RETURN r
    `;

    try {
      await this.neo4jService.write(query, { fromIntent, toIntent });
      this.logger.log(
        `Created intent transition: ${fromIntent} -> ${toIntent}`,
      );
    } catch (error) {
      this.logger.error('Error creating intent transition:', error);
      throw error;
    }
  }

  async findIntentFlow(userId: string): Promise<any[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:OWNS_CHAT]->(c:Chat)-[:CONTAINS_MESSAGE]->(m:Message)
      WHERE m.intent IS NOT NULL
      WITH m.intent as intent, m.timestamp as timestamp
      ORDER BY timestamp ASC
      WITH COLLECT({intent: intent, timestamp: timestamp}) as intentHistory
      UNWIND RANGE(0, SIZE(intentHistory) - 2) as i
      WITH intentHistory[i].intent as fromIntent, 
           intentHistory[i + 1].intent as toIntent,
           intentHistory[i].timestamp as fromTime,
           intentHistory[i + 1].timestamp as toTime
      RETURN fromIntent, toIntent, 
             duration.between(fromTime, toTime) as duration,
             COUNT(*) as frequency
      ORDER BY frequency DESC
    `;

    try {
      const result = await this.neo4jService.read(query, { userId });
      return result.records.map((record) => ({
        fromIntent: record.get('fromIntent'),
        toIntent: record.get('toIntent'),
        duration: record.get('duration'),
        frequency: record.get('frequency').toNumber(),
      }));
    } catch (error) {
      this.logger.error('Error finding intent flow:', error);
      return [];
    }
  }

  async findSimilarConversations(
    chatId: string,
    limit: number,
  ): Promise<any[]> {
    const query = `
      MATCH (c:Chat {id: $chatId})-[:CONTAINS_MESSAGE]->(m:Message)
      WHERE m.intent IS NOT NULL
      WITH c, COLLECT(DISTINCT m.intent) as intents
      MATCH (other:Chat)-[:CONTAINS_MESSAGE]->(otherMessage:Message)
      WHERE other.id <> $chatId AND otherMessage.intent IN intents
      WITH other, COUNT(DISTINCT otherMessage.intent) as sharedIntents, 
           SIZE(intents) as totalIntents
      WITH other, sharedIntents, totalIntents,
           (sharedIntents * 1.0 / totalIntents) as similarity
      WHERE similarity > 0.3
      ORDER BY similarity DESC
      LIMIT $limit
      MATCH (other)-[:CONTAINS_MESSAGE]->(msg:Message)
      WITH other, similarity, COUNT(msg) as messageCount, 
           MAX(msg.timestamp) as lastActivity
      RETURN other.id as chatId, other.title as title, 
             similarity, messageCount, lastActivity
    `;

    try {
      const result = await this.neo4jService.read(query, { chatId, limit });
      return result.records.map((record) => ({
        chatId: record.get('chatId'),
        title: record.get('title'),
        similarity: record.get('similarity'),
        messageCount: record.get('messageCount').toNumber(),
        lastActivity: record.get('lastActivity'),
      }));
    } catch (error) {
      this.logger.error('Error finding similar conversations:', error);
      return [];
    }
  }

  async updateConversationMetrics(
    sessionId: string,
    metrics: Record<string, any>,
  ): Promise<void> {
    const query = `
      MERGE (s:Session {id: $sessionId})
      SET s.metrics = $metrics,
          s.lastUpdated = datetime()
      RETURN s
    `;

    try {
      await this.neo4jService.write(query, { sessionId, metrics });
      this.logger.log(`Updated conversation metrics for session: ${sessionId}`);
    } catch (error) {
      this.logger.error('Error updating conversation metrics:', error);
      throw error;
    }
  }

  async findUserBehaviorPatterns(userId: string): Promise<any[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:OWNS_CHAT]->(c:Chat)-[:CONTAINS_MESSAGE]->(m:Message)
      WHERE m.intent IS NOT NULL
      WITH u, m.intent as intent, 
           duration.between(date(m.timestamp), date()).days as daysAgo,
           CASE 
             WHEN duration.between(date(m.timestamp), date()).days < 7 THEN 'recent'
             WHEN duration.between(date(m.timestamp), date()).days < 30 THEN 'month'
             ELSE 'older'
           END as period
      
      WITH u, intent, period, COUNT(*) as frequency
      ORDER BY frequency DESC
      
      WITH u, COLLECT({
        intent: intent,
        period: period,
        frequency: frequency
      }) as intentPatterns
      
      MATCH (u)-[:OWNS_CHAT]->(c:Chat)
      WITH u, intentPatterns, COUNT(DISTINCT c) as totalChats
      
      MATCH (u)-[:OWNS_CHAT]->(c:Chat)-[:CONTAINS_MESSAGE]->(m:Message)
      WITH u, intentPatterns, totalChats,
           AVG(SIZE(m.content)) as avgMessageLength,
           COUNT(m) as totalMessages
      
      RETURN {
        userId: u.id,
        totalChats: totalChats,
        totalMessages: totalMessages,
        avgMessageLength: avgMessageLength,
        intentPatterns: intentPatterns
      } as userBehavior
    `;

    try {
      const result = await this.neo4jService.read(query, { userId });
      return result.records.map((record) => record.get('userBehavior'));
    } catch (error) {
      this.logger.error('Error finding user behavior patterns:', error);
      return [];
    }
  }

  async createEntityMentionRelationship(
    messageId: string,
    entityId: string,
  ): Promise<void> {
    const query = `
      MERGE (m:Message {id: $messageId})
      MERGE (e:Entity {id: $entityId})
      MERGE (m)-[r:MENTIONS]->(e)
      SET r.createdAt = datetime()
      RETURN r
    `;

    try {
      await this.neo4jService.write(query, { messageId, entityId });
      this.logger.log(`Created entity mention: ${messageId} -> ${entityId}`);
    } catch (error) {
      this.logger.error('Error creating entity mention relationship:', error);
      throw error;
    }
  }

  // Additional utility methods for comprehensive graph operations

  async createChatWithMessages(
    userId: string,
    chatId: string,
    sessionId: string,
    chatTitle: string,
  ): Promise<void> {
    const query = `
      MERGE (u:User {id: $userId})
      MERGE (c:Chat {id: $chatId})
      MERGE (s:Session {id: $sessionId})
      MERGE (u)-[:OWNS_CHAT]->(c)
      MERGE (s)-[:BELONGS_TO_CHAT]->(c)
      SET c.title = $chatTitle,
          c.createdAt = datetime(),
          c.status = 'ACTIVE'
      RETURN c
    `;

    try {
      await this.neo4jService.write(query, {
        userId,
        chatId,
        sessionId,
        chatTitle,
      });
      this.logger.log(`Created chat with session: ${chatId}`);
    } catch (error) {
      this.logger.error('Error creating chat with messages:', error);
      throw error;
    }
  }

  async addMessageToChat(
    chatId: string,
    messageId: string,
    messageType: string,
    content: string,
    intent?: string,
    confidence?: number,
  ): Promise<void> {
    const query = `
      MERGE (c:Chat {id: $chatId})
      MERGE (m:Message {id: $messageId})
      MERGE (c)-[:CONTAINS_MESSAGE]->(m)
      SET m.type = $messageType,
          m.content = $content,
          m.intent = $intent,
          m.confidence = $confidence,
          m.timestamp = datetime()
      RETURN m
    `;

    try {
      await this.neo4jService.write(query, {
        chatId,
        messageId,
        messageType,
        content,
        intent,
        confidence,
      });
      this.logger.log(`Added message to chat: ${messageId} -> ${chatId}`);
    } catch (error) {
      this.logger.error('Error adding message to chat:', error);
      throw error;
    }
  }

  async findEntityCoOccurrences(
    entityId: string,
    limit: number,
  ): Promise<any[]> {
    const query = `
      MATCH (e:Entity {id: $entityId})<-[:MENTIONS]-(m:Message)-[:MENTIONS]->(other:Entity)
      WHERE other.id <> $entityId
      WITH other, COUNT(m) as coOccurrences
      ORDER BY coOccurrences DESC
      LIMIT $limit
      RETURN other.id as entityId, other.name as entityName, 
             other.type as entityType, coOccurrences
    `;

    try {
      const result = await this.neo4jService.read(query, { entityId, limit });
      return result.records.map((record) => ({
        entityId: record.get('entityId'),
        entityName: record.get('entityName'),
        entityType: record.get('entityType'),
        coOccurrences: record.get('coOccurrences').toNumber(),
      }));
    } catch (error) {
      this.logger.error('Error finding entity co-occurrences:', error);
      return [];
    }
  }

  async findConversationClusters(minClusterSize: number = 3): Promise<any[]> {
    const query = `
      MATCH (c:Chat)-[:CONTAINS_MESSAGE]->(m:Message)
      WHERE m.intent IS NOT NULL
      WITH c, COLLECT(DISTINCT m.intent) as intents
      WITH intents, COLLECT(c) as chats
      WHERE SIZE(chats) >= $minClusterSize
      WITH intents, chats, SIZE(chats) as clusterSize
      ORDER BY clusterSize DESC
      RETURN {
        commonIntents: intents,
        chats: [chat IN chats | chat.id],
        clusterSize: clusterSize
      } as cluster
    `;

    try {
      const result = await this.neo4jService.read(query, { minClusterSize });
      return result.records.map((record) => record.get('cluster'));
    } catch (error) {
      this.logger.error('Error finding conversation clusters:', error);
      return [];
    }
  }

  async getConversationAnalytics(timeframe: string = '30d'): Promise<any> {
    const query = `
      MATCH (c:Chat)-[:CONTAINS_MESSAGE]->(m:Message)
      WHERE m.timestamp >= datetime() - duration('P${timeframe}')
      WITH c, COUNT(m) as messageCount, 
           COLLECT(DISTINCT m.intent) as uniqueIntents,
           duration.between(MIN(m.timestamp), MAX(m.timestamp)) as conversationDuration
      
      RETURN {
        totalConversations: COUNT(c),
        avgMessagesPerConversation: AVG(messageCount),
        avgConversationDuration: AVG(conversationDuration.seconds) / 60,
        mostCommonIntents: [intent IN COLLECT(uniqueIntents) | intent][0..5],
        conversationLengthDistribution: {
          short: SIZE([conv IN COLLECT(messageCount) WHERE conv <= 5]),
          medium: SIZE([conv IN COLLECT(messageCount) WHERE conv > 5 AND conv <= 15]),
          long: SIZE([conv IN COLLECT(messageCount) WHERE conv > 15])
        }
      } as analytics
    `;

    try {
      const result = await this.neo4jService.read(query, {});
      return result.records.length > 0
        ? result.records[0].get('analytics')
        : null;
    } catch (error) {
      this.logger.error('Error getting conversation analytics:', error);
      return null;
    }
  }

  async findInfluentialMessages(limit: number = 10): Promise<any[]> {
    const query = `
      MATCH (m:Message)-[:MENTIONS]->(e:Entity)
      WITH m, COUNT(DISTINCT e) as entityCount
      MATCH (m)-[:FOLLOWED_BY]->(next:Message)
      WITH m, entityCount, COUNT(next) as followupCount
      WITH m, entityCount, followupCount, 
           (entityCount * 2 + followupCount) as influenceScore
      ORDER BY influenceScore DESC
      LIMIT $limit
      RETURN m.id as messageId, m.content as content, 
             m.intent as intent, m.timestamp as timestamp,
             entityCount, followupCount, influenceScore
    `;

    try {
      const result = await this.neo4jService.read(query, { limit });
      return result.records.map((record) => ({
        messageId: record.get('messageId'),
        content: record.get('content'),
        intent: record.get('intent'),
        timestamp: record.get('timestamp'),
        entityCount: record.get('entityCount').toNumber(),
        followupCount: record.get('followupCount').toNumber(),
        influenceScore: record.get('influenceScore').toNumber(),
      }));
    } catch (error) {
      this.logger.error('Error finding influential messages:', error);
      return [];
    }
  }

  async createIntentSequencePattern(
    intentSequence: string[],
    frequency: number,
  ): Promise<void> {
    const query = `
      CREATE (pattern:IntentPattern {
        sequence: $intentSequence,
        frequency: $frequency,
        createdAt: datetime()
      })
      RETURN pattern
    `;

    try {
      await this.neo4jService.write(query, { intentSequence, frequency });
      this.logger.log(
        `Created intent sequence pattern: ${intentSequence.join(' -> ')}`,
      );
    } catch (error) {
      this.logger.error('Error creating intent sequence pattern:', error);
      throw error;
    }
  }

  async findUserJourney(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const query = `
      MATCH (u:User {id: $userId})-[:OWNS_CHAT]->(c:Chat)-[:CONTAINS_MESSAGE]->(m:Message)
      WHERE m.timestamp >= datetime($startDate) AND m.timestamp <= datetime($endDate)
      WITH m, c
      ORDER BY m.timestamp ASC
      RETURN {
        messageId: m.id,
        chatId: c.id,
        chatTitle: c.title,
        content: m.content,
        intent: m.intent,
        timestamp: m.timestamp,
        type: m.type
      } as journeyStep
    `;

    try {
      const result = await this.neo4jService.read(query, {
        userId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      return result.records.map((record) => record.get('journeyStep'));
    } catch (error) {
      this.logger.error('Error finding user journey:', error);
      return [];
    }
  }
}
