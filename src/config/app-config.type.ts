export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  backendDomain: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
  neo4j: {
    uri: string;
    username: string;
    password: string;
  };
  mistral: {
    model: string;
    embeddingModel: string;
    temperature: string;
    maxTokens: string;
    apiKey: string;
  };
};
