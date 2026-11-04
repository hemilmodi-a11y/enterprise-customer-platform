import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';

import { KnowledgeContextDocument } from './interfaces/knowledge-context-document.interface';
import {
  CUSTOMER_SUPPORT_HUMAN_PROMPT,
  CUSTOMER_SUPPORT_SYSTEM_PROMPT,
} from './prompts/customer-support.prompt';

@Injectable()
export class LlmProviderService {
  private readonly logger = new Logger(LlmProviderService.name);

  constructor(private readonly config: ConfigService) {}

  async generateAnswer(
    question: string,
    documents: readonly KnowledgeContextDocument[],
  ): Promise<string> {
    const apiKey = this.config.get<string>('AI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'The AI provider is not configured',
      );
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', CUSTOMER_SUPPORT_SYSTEM_PROMPT],
      ['human', CUSTOMER_SUPPORT_HUMAN_PROMPT],
    ]);

    try {
      const messages = await prompt.formatMessages({
        question,
        context: JSON.stringify(documents),
      });
      const response = await this.createModel(apiKey).invoke(messages);
      if (typeof response.content !== 'string' || !response.content.trim()) {
        throw new BadGatewayException(
          'The AI provider returned an invalid response',
        );
      }
      return response.content.trim();
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        this.logger.warn(
          JSON.stringify({ event: 'ai_provider_timeout', provider: 'openai' }),
        );
        throw new GatewayTimeoutException('The AI provider request timed out');
      }
      if (this.providerStatus(error) === 429) {
        this.logger.warn(
          JSON.stringify({
            event: 'ai_provider_rate_limited',
            provider: 'openai',
          }),
        );
        throw new HttpException(
          'The AI provider rate limit was reached',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (
        error instanceof Error &&
        /timeout|timed out|abort/i.test(error.name)
      ) {
        this.logger.warn(
          JSON.stringify({ event: 'ai_provider_timeout', provider: 'openai' }),
        );
        throw new GatewayTimeoutException('The AI provider request timed out');
      }

      this.logger.error(
        JSON.stringify({
          event: 'ai_provider_failure',
          provider: 'openai',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      throw new ServiceUnavailableException('The AI provider is unavailable');
    }
  }

  createModel(apiKey: string): ChatOpenAI {
    return new ChatOpenAI({
      apiKey,
      model: this.config.get<string>('AI_MODEL', 'gpt-4o-mini'),
      temperature: this.config.get<number>('AI_TEMPERATURE', 0.2),
      maxTokens: this.config.get<number>('AI_MAX_TOKENS', 512),
      timeout: this.config.get<number>('AI_TIMEOUT_MS', 15000),
      maxRetries: 0,
    });
  }

  private providerStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) {
      return undefined;
    }
    const record = error as {
      status?: unknown;
      statusCode?: unknown;
      response?: { status?: unknown };
    };
    const status =
      record.status ?? record.statusCode ?? record.response?.status;
    return typeof status === 'number' ? status : undefined;
  }
}
