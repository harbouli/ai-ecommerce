/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';

export interface ImageAnalysisRequest {
  imageUrl?: string;
  imageData?: string;
  analysisType:
    | 'product_analysis'
    | 'text_extraction'
    | 'object_detection'
    | 'visual_qa';
  model: string;
  userQuery?: string;
}

export interface ImageAnalysisResponse {
  analysis: string;
  confidence: number;
  detectedObjects?: Array<{
    label: string;
    confidence: number;
  }>;
  extractedText?: string;
  productInfo?: {
    category: string;
    brand?: string;
    features: string[];
  };
  model: string;
}

@Injectable()
export class ImageAnalysisService {
  private readonly logger = new Logger(ImageAnalysisService.name);
  private readonly mistralClient: Mistral;

  constructor(private readonly configService: ConfigService) {
    this.mistralClient = new Mistral({
      // eslint-disable-next-line no-restricted-syntax
      apiKey: this.configService.get<string>('MISTRAL_API_KEY') || '',
    });
  }

  async analyzeImage(
    request: ImageAnalysisRequest,
  ): Promise<ImageAnalysisResponse> {
    this.logger.log(`Analyzing image: ${request.analysisType}`);

    try {
      if (
        request.model.includes('pixtral') ||
        request.model.includes('mistral')
      ) {
        return await this.analyzeWithMistral(request);
      } else if (request.model.includes('gpt-4')) {
        return await this.analyzeWithOpenAI(request);
      } else {
        return this.getMockResponse(request);
      }
    } catch (error) {
      this.logger.error(`Image analysis failed: ${error.message}`);
      return this.getMockResponse(request);
    }
  }

  private async analyzeWithMistral(
    request: ImageAnalysisRequest,
  ): Promise<ImageAnalysisResponse> {
    const prompt = this.getPrompt(request);

    const messages = [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: prompt },
          {
            type: 'image_url' as const,
            imageUrl: {
              url:
                request.imageUrl ||
                `data:image/jpeg;base64,${request.imageData}`,
            },
          },
        ],
      },
    ];

    const response = await this.mistralClient.chat.complete({
      model: request.model,
      messages,
      temperature: 0.3,
      maxTokens: 500,
    });

    const analysisText =
      (response.choices?.[0]?.message?.content as string) || '';
    return this.parseResponse(analysisText, request);
  }

  private async analyzeWithOpenAI(
    request: ImageAnalysisRequest,
  ): Promise<ImageAnalysisResponse> {
    const prompt = this.getPrompt(request);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.configService.get('OPENAI_API_KEY', { infer: true })}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url:
                    request.imageUrl ||
                    `data:image/jpeg;base64,${request.imageData}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    const result = await response.json();
    const analysisText = result.choices?.[0]?.message?.content || '';
    return this.parseResponse(analysisText, request);
  }

  private getPrompt(request: ImageAnalysisRequest): string {
    switch (request.analysisType) {
      case 'product_analysis':
        return `Analyze this product image. Return JSON with:
{
  "description": "detailed description",
  "category": "product category", 
  "brand": "brand name or null",
  "features": ["feature1", "feature2"],
  "objects": [{"label": "object name", "confidence": 0.9}]
}`;

      case 'text_extraction':
        return `Extract all text from this image. Return JSON: {"text": "extracted text", "confidence": 0.9}`;

      case 'object_detection':
        return `Detect objects in this image. Return JSON: {"objects": [{"label": "name", "confidence": 0.9}], "description": "what you see"}`;

      case 'visual_qa':
        return `Answer this question about the image: "${request.userQuery}". Be specific and detailed.`;

      default:
        return 'Describe what you see in this image.';
    }
  }

  private parseResponse(
    text: string,
    request: ImageAnalysisRequest,
  ): ImageAnalysisResponse {
    try {
      // Try to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let data: any = {};

      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      }

      return {
        analysis: data.description || text,
        confidence: data.confidence || 0.85,
        detectedObjects: data.objects || [],
        extractedText: data.text || '',
        productInfo: {
          category: data.category || '',
          brand: data.brand || null,
          features: data.features || [],
        },
        model: request.model,
      };
    } catch (error) {
      return {
        analysis: text,
        confidence: 0.8,
        model: request.model,
      };
    }
  }

  private getMockResponse(
    request: ImageAnalysisRequest,
  ): ImageAnalysisResponse {
    return {
      analysis: `Mock analysis for ${request.analysisType}`,
      confidence: 0.85,
      detectedObjects: [
        { label: 'product', confidence: 0.9 },
        { label: 'electronics', confidence: 0.8 },
      ],
      extractedText: 'Sample text',
      productInfo: {
        category: 'electronics',
        brand: 'TechBrand',
        features: ['wireless', 'bluetooth', 'premium'],
      },
      model: request.model,
    };
  }
}
