import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OpenRequestsQueryDto } from './dto/open-requests-query.dto';
import { OpenRequestsByCategoryResponseDto } from './dto/open-requests-response.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('open-requests-by-category')
  @Roles('Admin', 'Manager', 'SupportAgent')
  @ApiOperation({
    summary: 'Count open service requests grouped by service category',
  })
  @ApiOkResponse({ type: OpenRequestsByCategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid category filter' })
  @ApiForbiddenResponse({
    description: 'An authorized support role is required',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiServiceUnavailableResponse({
    description: 'MongoDB reporting storage is temporarily unavailable',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    maxLength: 100,
    description: 'Optionally include only this service category.',
  })
  openRequestsByCategory(@Query() query: OpenRequestsQueryDto) {
    return this.analyticsService.openRequestsByCategory(query);
  }
}
