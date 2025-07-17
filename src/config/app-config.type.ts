export type Neo4jConfig = {
  uri: string;
  username: string;
  password: string;
};

export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  backendDomain?: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
  neo4j: Neo4jConfig;

  gemini: {
    apiKey: string;
    model: string;
    embeddingModel: string;
    temperature: number;
    maxTokens: number;
    topP: number;
    topK: number;
  };
};
