import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ClassifyTicketDto } from './dto/classify-ticket.dto';
import { TicketClassificationResponseDto } from './dto/ticket-classification-response.dto';
import {
  TICKET_CLASSIFICATION_JSON_SCHEMA,
  TICKET_CLASSIFICATION_SYSTEM_PROMPT,
} from './prompts/ticket-classification.prompt';
import { LlmProviderService } from './llm-provider.service';

@Injectable()
export class TicketClassificationService {
  private readonly logger = new Logger(TicketClassificationService.name);

  constructor(
    private readonly llmProvider: LlmProviderService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<boolean>('AI_TICKET_CLASSIFICATION_ENABLED', false);
  }

  async classify(
    ticket: ClassifyTicketDto,
  ): Promise<TicketClassificationResponseDto> {
    const raw = await this.llmProvider.generateStructuredOutput(
      TICKET_CLASSIFICATION_SYSTEM_PROMPT,
      {
        title: ticket.title,
        description: ticket.description,
        serviceName: ticket.serviceName ?? '',
      },
      TICKET_CLASSIFICATION_JSON_SCHEMA,
      'ticket_classification',
    );
    const result = plainToInstance(TicketClassificationResponseDto, raw);
    const errors = validateSync(result, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      this.logger.warn(
        JSON.stringify({
          event: 'ticket_classification_invalid_output',
          validationErrorCount: errors.length,
        }),
      );
      throw new BadGatewayException(
        'The AI provider returned an invalid ticket classification',
      );
    }

    return result;
  }
}
