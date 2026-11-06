import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { AiController } from './ai.controller';
import { TicketClassificationController } from './ticket-classification.controller';
import { AiService } from './ai.service';
import { LlmProviderService } from './llm-provider.service';
import { TicketClassificationService } from './ticket-classification.service';

@Module({
  imports: [AuthModule, KnowledgeBaseModule],
  controllers: [AiController, TicketClassificationController],
  providers: [AiService, LlmProviderService, TicketClassificationService],
  exports: [TicketClassificationService],
})
export class AiModule {}
