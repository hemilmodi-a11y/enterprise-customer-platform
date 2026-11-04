import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { KnowledgeIndexingService } from '../knowledge-base/knowledge-indexing.service';
import { AiCustomerSupportResponseDto } from './dto/ai-response.dto';
import { LlmProviderService } from './llm-provider.service';

const NO_KNOWLEDGE_ANSWER =
  'I could not find published information that answers your question. Please contact customer support for help.';
const MAX_DOCUMENT_CONTEXT_CHARS = 6000;
const MAX_TOTAL_CONTEXT_CHARS = 24000;

@Injectable()
export class AiService {
  constructor(
    private readonly knowledgeIndexing: KnowledgeIndexingService,
    private readonly llmProvider: LlmProviderService,
    private readonly config: ConfigService,
  ) {}

  async askQuestion(
    question: string,
    actor: AuthenticatedUser,
  ): Promise<AiCustomerSupportResponseDto> {
    const chunks = await this.knowledgeIndexing.searchForAssistant(
      question,
      actor,
      this.config.get<number>('RAG_TOP_K', 5),
    );
    if (chunks.length === 0) {
      return {
        answer: NO_KNOWLEDGE_ANSWER,
        sources: [],
        confidence: null,
      };
    }

    let remainingContextChars = MAX_TOTAL_CONTEXT_CHARS;
    const contextDocuments = chunks.flatMap((chunk) => {
      if (remainingContextChars <= 0) {
        return [];
      }
      const content = chunk.content.slice(
        0,
        Math.min(MAX_DOCUMENT_CONTEXT_CHARS, remainingContextChars),
      );
      remainingContextChars -= content.length;
      return content.trim()
        ? [
            {
              documentId: chunk.documentId,
              name: chunk.documentName,
              category: chunk.category,
              department: chunk.department,
              version: chunk.version,
              chunkIndex: chunk.chunkIndex,
              sourceReference: chunk.sourceReference,
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
        version: document.version,
        chunkIndex: document.chunkIndex,
        sourceReference: document.sourceReference,
      })),
      confidence: null,
    };
  }
}
