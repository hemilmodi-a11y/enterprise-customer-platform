import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClassifyTicketDto } from './dto/classify-ticket.dto';
import { TicketClassificationResponseDto } from './dto/ticket-classification-response.dto';
import { TicketClassificationService } from './ticket-classification.service';

@ApiTags('ai-ticket-classification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager', 'SupportAgent')
@Controller('api/v1/ai/tickets')
export class TicketClassificationController {
  constructor(private readonly classification: TicketClassificationService) {}

  @Post('classify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Classify ticket category, priority, confidence, and reason',
  })
  @ApiOkResponse({ type: TicketClassificationResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid ticket classification input' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Admin, Manager, or SupportAgent role required',
  })
  @ApiResponse({
    status: 429,
    description: 'Request or AI provider rate limit reached',
  })
  @ApiResponse({
    status: 502,
    description: 'AI returned invalid structured data',
  })
  @ApiResponse({ status: 503, description: 'AI provider is unavailable' })
  @ApiResponse({ status: 504, description: 'AI provider request timed out' })
  classify(
    @Body() dto: ClassifyTicketDto,
  ): Promise<TicketClassificationResponseDto> {
    return this.classification.classify(dto);
  }
}
