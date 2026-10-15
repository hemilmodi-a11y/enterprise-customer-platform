import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  MarkAllNotificationsReadResponseDto,
  NotificationResponseDto,
  PaginatedNotificationsResponseDto,
  UnreadNotificationCountResponseDto,
} from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Create a notification for a user' })
  @ApiCreatedResponse({ type: NotificationResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid notification payload' })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  @ApiNotFoundResponse({ description: 'Recipient user not found' })
  @ApiServiceUnavailableResponse({
    description: 'Notification storage unavailable',
  })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications belonging to the current user' })
  @ApiOkResponse({ type: PaginatedNotificationsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid pagination or filter values' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiServiceUnavailableResponse({
    description: 'Notification storage unavailable',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    type: Boolean,
    description: 'When true, return only unread notifications.',
  })
  @ApiQuery({
    name: 'isRead',
    required: false,
    type: Boolean,
    description: 'Filter by read state; takes precedence over unreadOnly.',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
  })
  listMine(
    @Query() query: ListNotificationsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.listForUser(request.user.userId, query);
  }

  @Get('me')
  @ApiOperation({
    summary: 'List the current user’s notifications (legacy route)',
    deprecated: true,
  })
  @ApiOkResponse({ type: PaginatedNotificationsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid pagination or filter values' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiServiceUnavailableResponse({
    description: 'Notification storage unavailable',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  listMineLegacy(
    @Query() query: ListNotificationsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notificationsService.listForUser(request.user.userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get the current user’s unread notification count' })
  @ApiOkResponse({ type: UnreadNotificationCountResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiServiceUnavailableResponse({
    description: 'Notification storage unavailable',
  })
  async unreadCount(@Req() request: AuthenticatedRequest) {
    return {
      unreadCount: await this.notificationsService.unreadCountForUser(
        request.user.userId,
      ),
    };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all current-user notifications as read' })
  @ApiOkResponse({ type: MarkAllNotificationsReadResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiServiceUnavailableResponse({
    description: 'Notification storage unavailable',
  })
  async markAllRead(@Req() request: AuthenticatedRequest) {
    return {
      updatedCount: await this.notificationsService.markAllReadForUser(
        request.user.userId,
      ),
    };
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark one of the current user’s notifications as read',
  })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiServiceUnavailableResponse({
    description: 'Notification storage unavailable',
  })
  markRead(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.notificationsService.markRead(id, request.user.userId);
  }
}
