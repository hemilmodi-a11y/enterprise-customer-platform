import { Controller, Get, Param, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HighPriorityAgentRequestDto, PaginatedAgentRequestsResponseDto } from './dto/high-priority-request-response.dto';
import { ListAgentRequestsQueryDto } from './dto/list-agent-requests-query.dto';
import { RequestsService } from './requests.service';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/agents')
export class AgentRequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get(':agentId/requests/high-priority-open')
  @Roles('Admin', 'Manager', 'SupportAgent')
  @ApiOperation({
    summary: 'List an agent’s high-priority open service requests',
    description:
      'High priority includes High and Urgent. Support agents may query only their own user ID; Admins and Managers may query any support agent.',
  })
  @ApiOkResponse({ type: PaginatedAgentRequestsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid agent ID or pagination values' })
  @ApiForbiddenResponse({ description: 'Insufficient role or agent-scope access' })
  @ApiNotFoundResponse({ description: 'Support agent not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 100 })
  listHighPriorityOpen(
    @Param('agentId', ParseIntPipe) agentId: number,
    @Query() query: ListAgentRequestsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PaginatedAgentRequestsResponseDto> {
    return this.requestsService.listHighPriorityOpenByAgent(
      agentId,
      query,
      request.user,
    );
  }
}
