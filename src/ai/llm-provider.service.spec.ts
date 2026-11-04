import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage } from '@langchain/core/messages';

import { KnowledgeDocumentCategory } from '../knowledge-base/knowledge-document.enums';
import { KnowledgeContextDocument } from './interfaces/knowledge-context-document.interface';
import { CUSTOMER_SUPPORT_SYSTEM_PROMPT } from './prompts/customer-support.prompt';
import { LlmProviderService } from './llm-provider.service';

const contextDocument: KnowledgeContextDocument = {
  documentId: '4cb1c6d3-5179-40df-8a24-6f9fd5c413a6',
  name: 'Router guide',
  category: KnowledgeDocumentCategory.TROUBLESHOOTING_GUIDE,
  department: 'Customer Support',
  content: 'Restart the router after checking the power cable.',
};

describe('LlmProviderService', () => {
  let service: LlmProviderService;
  let config: { get: jest.Mock };

  beforeEach(() => {
    config = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          AI_API_KEY: 'test-key-not-a-real-credential',
          AI_MODEL: 'gpt-4o-mini',
          AI_TEMPERATURE: 0.1,
          AI_MAX_TOKENS: 256,
          AI_TIMEOUT_MS: 12000,
        };
        return values[key] ?? defaultValue;
      }),
    };
    service = new LlmProviderService(config as never);
  });

  it('builds a grounded prompt and returns the mocked model response', async () => {
    const invoke = jest
      .spyOn(ChatOpenAI.prototype, 'invoke')
      .mockResolvedValue(
        new AIMessage('Restart the router and check its power.'),
      );

    const answer = await service.generateAnswer('My router stopped working.', [
      contextDocument,
    ]);

    expect(answer).toBe('Restart the router and check its power.');
    const messages = invoke.mock.calls[0]?.[0];
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: CUSTOMER_SUPPORT_SYSTEM_PROMPT,
        }),
        expect.objectContaining({
          content: expect.stringContaining('My router stopped working.'),
        }),
        expect.objectContaining({
          content: expect.stringContaining(contextDocument.content),
        }),
      ]),
    );
    expect(config.get).toHaveBeenCalledWith('AI_TIMEOUT_MS', 15000);
    invoke.mockRestore();
  });

  it('returns an explicit unavailable error when no API key is configured', async () => {
    config.get.mockImplementation((key: string, defaultValue?: unknown) =>
      key === 'AI_API_KEY' ? undefined : defaultValue,
    );

    await expect(
      service.generateAnswer('Question', [contextDocument]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('uses the configured model, generation limits, and timeout', () => {
    const model = service.createModel('test-key-not-a-real-credential');

    expect(model).toMatchObject({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 256,
      timeout: 12000,
    });
  });

  it('maps provider rate limits, timeouts, and empty model responses safely', async () => {
    const invoke = jest.spyOn(ChatOpenAI.prototype, 'invoke');
    invoke.mockRejectedValueOnce(
      Object.assign(new Error('rate limited'), { status: 429 }),
    );
    const rateLimitError = await service
      .generateAnswer('Question', [contextDocument])
      .catch((error: unknown) => error);
    expect(rateLimitError).toBeInstanceOf(HttpException);
    if (rateLimitError instanceof HttpException) {
      expect(rateLimitError.getStatus()).toBe(429);
    }

    invoke.mockRejectedValueOnce(
      Object.assign(new Error('request timeout'), { name: 'AbortError' }),
    );
    await expect(
      service.generateAnswer('Question', [contextDocument]),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);

    invoke.mockResolvedValueOnce(new AIMessage('  '));
    await expect(
      service.generateAnswer('Question', [contextDocument]),
    ).rejects.toBeInstanceOf(BadGatewayException);
    invoke.mockRestore();
  });
});
