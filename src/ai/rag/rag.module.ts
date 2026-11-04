import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { KnowledgeChunkingService } from './knowledge-chunking.service';
import { RagVectorStoreService } from './rag-vector-store.service';

@Module({
  imports: [ConfigModule],
  providers: [KnowledgeChunkingService, RagVectorStoreService],
  exports: [KnowledgeChunkingService, RagVectorStoreService],
})
export class RagModule {}
