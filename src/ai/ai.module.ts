import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LlmProviderService } from './llm-provider.service';

@Module({
  imports: [AuthModule, KnowledgeBaseModule],
  controllers: [AiController],
  providers: [AiService, LlmProviderService],
})
export class AiModule {}
