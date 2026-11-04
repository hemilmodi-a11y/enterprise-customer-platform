import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { AiCustomerSupportResponseDto } from './dto/ai-response.dto';
import { LlmProviderService } from './llm-provider.service';

const NO_KNOWLEDGE_ANSWER =
  'I could not find published information that answers your question. Please contact customer support for help.';
const MAX_DOCUMENT_CONTEXT_CHARS = 6000;
const MAX_TOTAL_CONTEXT_CHARS = 24000;

@Injectable()
export class AiService {
  constructor(
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly llmProvider: LlmProviderService,
    private readonly config: ConfigService,
  ) {}

  async askQuestion(
    question: string,
    actor: AuthenticatedUser,
  ): Promise<AiCustomerSupportResponseDto> {
    const documents = await this.knowledgeBase.searchForAssistant(
      question,
      actor,
      this.config.get<number>('AI_RETRIEVAL_LIMIT', 5),
    );
    if (documents.length === 0) {
      return {
        answer: NO_KNOWLEDGE_ANSWER,
        sources: [],
        confidence: null,
      };
    }

    let remainingContextChars = MAX_TOTAL_CONTEXT_CHARS;
    const contextDocuments = documents.flatMap((document) => {
      if (remainingContextChars <= 0) {
        return [];
      }
      const content = document.content.slice(
        0,
        Math.min(MAX_DOCUMENT_CONTEXT_CHARS, remainingContextChars),
      );
      remainingContextChars -= content.length;
      return content.trim()
        ? [
            {
              documentId: document.documentId,
              name: document.name,
              category: document.category,
              department: document.department,
              content,
            },
          ]
        : [];
    });
    if (contextDocuments.length === 0) {
      return {
        answer: NO_KNOWLEDGE_ANSWER,
        sources: [],
        confidence: null,
      };
    }

    const answer = await this.llmProvider.generateAnswer(
      question,
      contextDocuments,
    );
    if (!answer.trim()) {
      throw new BadGatewayException('The AI provider returned an empty answer');
    }

    return {
      answer,
      sources: contextDocuments.map((document) => ({
        documentId: document.documentId,
        documentName: document.name,
        category: document.category,
      })),
      confidence: null,
    };
  }
}
