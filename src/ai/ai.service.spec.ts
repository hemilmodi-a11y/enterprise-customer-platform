import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { KnowledgeDocumentCategory } from '../knowledge-base/knowledge-document.enums';
import { AiService } from './ai.service';
import { AskQuestionDto } from './dto/ask-question.dto';

const customer: AuthenticatedUser = {
  userId: 3,
  email: 'customer@example.test',
  roles: ['Customer'],
};

const chunk = {
  documentId: '4cb1c6d3-5179-40df-8a24-6f9fd5c413a6',
  documentName: 'Internet troubleshooting',
  category: KnowledgeDocumentCategory.TROUBLESHOOTING_GUIDE,
  department: 'Customer Support',
  version: 2,
  chunkIndex: 1,
  sourceReference: 'router-guide.pdf',
  content: 'Check the router power and network cable.',
  similarity: 0.81,
};

describe('AiService', () => {
  let service: AiService;
  let indexing: { searchForAssistant: jest.Mock };
  let provider: { generateAnswer: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    indexing = {
      searchForAssistant: jest.fn().mockResolvedValue([chunk]),
    };
    provider = {
      generateAnswer: jest.fn().mockResolvedValue('Check the router power.'),
    };
    config = { get: jest.fn().mockReturnValue(5) };
    service = new AiService(
      indexing as never,
      provider as never,
      config as never,
    );
  });

  it('retrieves published knowledge and returns its source without confidence claims', async () => {
    const response = await service.askQuestion(
      'How do I troubleshoot internet?',
      customer,
    );

    expect(indexing.searchForAssistant).toHaveBeenCalledWith(
      'How do I troubleshoot internet?',
      customer,
      5,
    );
    expect(provider.generateAnswer).toHaveBeenCalledWith(
      'How do I troubleshoot internet?',
      [
        {
          documentId: chunk.documentId,
          name: chunk.documentName,
          category: chunk.category,
          department: chunk.department,
          version: chunk.version,
          chunkIndex: chunk.chunkIndex,
          sourceReference: chunk.sourceReference,
          content: chunk.content,
        },
      ],
    );
    expect(response).toEqual({
      answer: 'Check the router power.',
      sources: [
        {
          documentId: chunk.documentId,
          documentName: chunk.documentName,
          category: chunk.category,
          version: chunk.version,
          chunkIndex: chunk.chunkIndex,
          sourceReference: chunk.sourceReference,
        },
      ],
      confidence: null,
    });
  });

  it('returns a safe fallback and skips the provider when retrieval finds nothing', async () => {
    indexing.searchForAssistant.mockResolvedValueOnce([]);

    const response = await service.askQuestion('Unknown policy?', customer);

    expect(response.answer).toContain('could not find published information');
    expect(response.sources).toEqual([]);
    expect(response.confidence).toBeNull();
    expect(provider.generateAnswer).not.toHaveBeenCalled();
  });

  it('caps per-document and total retrieved context before invoking the provider', async () => {
    indexing.searchForAssistant.mockResolvedValueOnce(
      Array.from({ length: 5 }, (_, index) => ({
        ...chunk,
        documentId: `${index}-${chunk.documentId}`,
        content: 'x'.repeat(10_000),
      })),
    );

    await service.askQuestion(
      'Question about router troubleshooting',
      customer,
    );

    const contexts = provider.generateAnswer.mock.calls[0]?.[1] as Array<{
      content: string;
    }>;
    expect(contexts.map(({ content }) => content.length)).toEqual([
      6000, 6000, 6000, 6000,
    ]);
    expect(
      contexts.reduce((total, { content }) => total + content.length, 0),
    ).toBeLessThanOrEqual(24_000);
  });

  it('rejects empty or oversized questions through DTO validation', () => {
    const emptyQuestion = plainToInstance(AskQuestionDto, { question: '  ' });
    const oversizedQuestion = plainToInstance(AskQuestionDto, {
      question: 'x'.repeat(1001),
    });

    expect(validateSync(emptyQuestion).length).toBeGreaterThan(0);
    expect(validateSync(oversizedQuestion).length).toBeGreaterThan(0);
  });

  it('propagates provider failures and rejects an empty answer', async () => {
    provider.generateAnswer.mockRejectedValueOnce(
      new ServiceUnavailableException('provider unavailable'),
    );
    await expect(
      service.askQuestion('What should I do?', customer),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    provider.generateAnswer.mockResolvedValueOnce('  ');
    await expect(
      service.askQuestion('What should I do?', customer),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
