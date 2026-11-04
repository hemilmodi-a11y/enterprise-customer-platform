import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

import { KnowledgeDocument } from '../../knowledge-base/knowledge-document.entity';

@Injectable()
export class KnowledgeChunkingService {
  constructor(private readonly config: ConfigService) {}

  async split(
    document: Pick<
      KnowledgeDocument,
      | 'documentId'
      | 'version'
      | 'name'
      | 'category'
      | 'department'
      | 'accessLevel'
      | 'status'
      | 'content'
      | 'fileName'
      | 'createdAt'
    >,
  ): Promise<Document[]> {
    const text = this.normalize(document.content);
    if (!text) {
      return [];
    }

    const chunkSize = this.config.get<number>('RAG_CHUNK_SIZE', 1000);
    const chunkOverlap = this.config.get<number>('RAG_CHUNK_OVERLAP', 150);
    if (chunkOverlap >= chunkSize) {
      throw new Error('RAG_CHUNK_OVERLAP must be smaller than RAG_CHUNK_SIZE');
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
    const chunks = await splitter.splitText(text);
    return chunks
      .filter((chunk) => chunk.trim().length > 0)
      .map(
        (pageContent, chunkIndex) =>
          new Document({
            pageContent,
            metadata: {
              documentId: document.documentId,
              documentName: document.name,
              category: document.category,
              department: document.department,
              version: document.version,
              accessLevel: document.accessLevel,
              status: document.status,
              chunkIndex,
              sourceReference: document.fileName ?? document.documentId,
              createdAt: document.createdAt.toISOString(),
              indexedAt: new Date().toISOString(),
            },
          }),
      );
  }

  private normalize(content: string): string {
    return content
      .replace(/\r\n?/g, '\n')
      .replaceAll('\0', '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
