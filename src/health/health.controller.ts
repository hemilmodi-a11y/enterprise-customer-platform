import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'The application process is running' })
  live() {
    return this.healthService.live();
  }

  @Get('ready')
  @ApiOkResponse({
    description: 'MySQL is available; optional dependency states are reported',
  })
  @ApiServiceUnavailableResponse({
    description:
      'The application cannot serve requests because MySQL is unavailable',
  })
  ready() {
    return this.healthService.ready();
  }
}
