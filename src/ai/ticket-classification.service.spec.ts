import { BadGatewayException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AiTicketCategory } from '../requests/ai-ticket-category.enum';
import { ServiceRequestPriority } from '../requests/service-request-priority.enum';
import { TicketClassificationService } from './ticket-classification.service';
import { TICKET_CLASSIFICATION_JSON_SCHEMA } from './prompts/ticket-classification.prompt';

describe('TicketClassificationService', () => {
  let service: TicketClassificationService;
  let llmProvider: { generateStructuredOutput: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    llmProvider = {
      generateStructuredOutput: jest.fn().mockResolvedValue({
        category: AiTicketCategory.ACCOUNT,
        priority: ServiceRequestPriority.NORMAL,
        confidence: 0.95,
        reason: 'The customer reports login failures after password resets.',
      }),
    };
    config = { get: jest.fn().mockReturnValue(false) };
    service = new TicketClassificationService(
      llmProvider as never,
      config as never,
    );
  });

  it('uses the existing provider with strict schema-constrained structured output', async () => {
    const result = await service.classify({
      title: 'Unable to access my account',
      description: 'Login fails after several password resets.',
    });

    expect(llmProvider.generateStructuredOutput).toHaveBeenCalledWith(
      expect.any(String),
      {
        title: 'Unable to access my account',
        description: 'Login fails after several password resets.',
        serviceName: '',
      },
      TICKET_CLASSIFICATION_JSON_SCHEMA,
      'ticket_classification',
    );
    expect(result).toMatchObject({
      category: AiTicketCategory.ACCOUNT,
      priority: ServiceRequestPriority.NORMAL,
      confidence: 0.95,
    });
  });

  it('supports all seven categories and the existing priority enum', async () => {
    const categories = Object.values(AiTicketCategory);
    for (const category of categories) {
      llmProvider.generateStructuredOutput.mockResolvedValueOnce({
        category,
        priority: ServiceRequestPriority.HIGH,
        confidence: 0.8,
        reason: `Classification evidence for ${category}.`,
      });
      await expect(
        service.classify({
          title: `Issue ${category}`,
          description: 'The customer describes a support issue.',
        }),
      ).resolves.toMatchObject({
        category,
        priority: ServiceRequestPriority.HIGH,
      });
    }
    expect(categories).toHaveLength(7);
  });

  it.each([
    {
      category: 'UNSUPPORTED',
      priority: ServiceRequestPriority.NORMAL,
      confidence: 0.8,
      reason: 'Invalid category.',
    },
    {
      category: AiTicketCategory.ACCOUNT,
      priority: 'CRITICAL',
      confidence: 0.8,
      reason: 'Invalid priority.',
    },
    {
      category: AiTicketCategory.ACCOUNT,
      priority: ServiceRequestPriority.NORMAL,
      confidence: 1.1,
      reason: 'Invalid confidence.',
    },
    {
      category: AiTicketCategory.ACCOUNT,
      priority: ServiceRequestPriority.NORMAL,
      confidence: '0.8',
      reason: 'Confidence must be a number.',
    },
    {
      category: AiTicketCategory.ACCOUNT,
      priority: ServiceRequestPriority.NORMAL,
      confidence: 0.8,
    },
  ])('rejects invalid structured classification data', async (output) => {
    llmProvider.generateStructuredOutput.mockResolvedValueOnce(output);
    await expect(
      service.classify({
        title: 'Test ticket',
        description: 'Testing malformed classification output.',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('exposes whether automatic classification is enabled', () => {
    expect(service.isEnabled()).toBe(false);
    config.get.mockReturnValueOnce(true);
    expect(service.isEnabled()).toBe(true);
  });
});
