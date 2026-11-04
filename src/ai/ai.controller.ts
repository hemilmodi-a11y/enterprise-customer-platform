import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
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

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AskQuestionDto } from './dto/ask-question.dto';
import { AiCustomerSupportResponseDto } from './dto/ai-response.dto';
import { AiService } from './ai.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('ai-customer-support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Customer', 'SupportAgent')
@Controller('api/v1/ai/customer-support')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Ask a question using published enterprise knowledge',
    description:
      'Customer accounts receive answers only from published PUBLIC documents. Support agents can use published non-confidential documents.',
  })
  @ApiOkResponse({ type: AiCustomerSupportResponseDto })
  @ApiBadRequestResponse({ description: 'Question is missing or invalid' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Customer or SupportAgent role required',
  })
  @ApiResponse({
    status: 429,
    description: 'Request or provider rate limit reached',
  })
  @ApiResponse({
    status: 503,
    description: 'AI provider is unavailable or not configured',
  })
  @ApiResponse({
    status: 502,
    description: 'AI provider returned invalid output',
  })
  @ApiResponse({ status: 504, description: 'AI provider request timed out' })
  ask(
    @Body() dto: AskQuestionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AiCustomerSupportResponseDto> {
    return this.aiService.askQuestion(dto.question, request.user);
  }
}
