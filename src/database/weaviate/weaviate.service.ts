import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { AllConfigType } from '../../config/config.type';

@Injectable()
export class WeaviateService implements OnModuleInit {
  private client: WeaviateClient;

  constructor(private configService: ConfigService<AllConfigType>) {}

  async onModuleInit() {
    const weaviateConfig = this.configService.get('database.weaviate', {
      infer: true,
    });

    this.client = weaviate.client({
      scheme: weaviateConfig?.scheme,
      host: `${weaviateConfig?.host}:${weaviateConfig?.port}`,
      apiKey: undefined,
    });

    // Test connection
    try {
      await this.client.misc.liveChecker().do();
      console.log('✅ Weaviate connection established');
    } catch (error) {
      console.error('❌ Weaviate connection failed:', error);
    }
  }

  getClient(): WeaviateClient {
    return this.client;
  }
}
