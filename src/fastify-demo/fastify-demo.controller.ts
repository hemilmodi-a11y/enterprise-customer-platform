import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EchoDto } from './dto/echo.dto';

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@Controller('api/v1')
export class FastifyDemoController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('system/status')
  status() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get('system/protected')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  protected(@Req() request: AuthenticatedRequest) {
    return {
      message: 'Authenticated access granted',
      userId: request.user.userId,
      roles: request.user.roles,
    };
  }

  @Post('demo/echo')
  @HttpCode(HttpStatus.OK)
  echo(@Body() body: EchoDto) {
    return { message: body.message };
  }
}
