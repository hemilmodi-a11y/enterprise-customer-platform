import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { RagModule } from '../ai/rag/rag.module';
import { KnowledgeDocument } from './knowledge-document.entity';
import { KnowledgeDocumentHead } from './knowledge-document-head.entity';
import { KnowledgeDocumentIndex } from './knowledge-document-index.entity';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeDocumentTextExtractorService } from './knowledge-document-text-extractor.service';
import { KnowledgeIndexingService } from './knowledge-indexing.service';
import { KnowledgeBaseService } from './knowledge-base.service';

@Module({
  imports: [
    AuthModule,
    RagModule,
    TypeOrmModule.forFeature([
      KnowledgeDocument,
      KnowledgeDocumentHead,
      KnowledgeDocumentIndex,
    ]),
  ],
  controllers: [KnowledgeBaseController],
  providers: [
    KnowledgeBaseService,
    KnowledgeIndexingService,
    KnowledgeDocumentTextExtractorService,
  ],
  exports: [KnowledgeBaseService, KnowledgeIndexingService],
})
export class KnowledgeBaseModule {}
