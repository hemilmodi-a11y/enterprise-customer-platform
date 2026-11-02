import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { KnowledgeDocument } from './knowledge-document.entity';
import { KnowledgeDocumentHead } from './knowledge-document-head.entity';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([KnowledgeDocument, KnowledgeDocumentHead]),
  ],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
