import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { KnowledgeChunkingService } from './knowledge-chunking.service';
import { RagQueryRewriterService } from './rag-query-rewriter.service';
import { RagVectorStoreService } from './rag-vector-store.service';

@Module({
  imports: [ConfigModule],
  providers: [
    KnowledgeChunkingService,
    RagQueryRewriterService,
    RagVectorStoreService,
  ],
  exports: [
    KnowledgeChunkingService,
    RagQueryRewriterService,
    RagVectorStoreService,
  ],
})
export class RagModule {}
