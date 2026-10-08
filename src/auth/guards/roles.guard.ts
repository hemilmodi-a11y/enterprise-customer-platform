import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(
        ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    // No @Roles() means authentication is enough.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const user = request.user as {
      userId: number;
      email: string;
      roles?: unknown;
    };

    if (!user) {
      throw new ForbiddenException(
        'User information is missing',
      );
    }

    const userRoles = Array.isArray(user.roles)
      ? user.roles
      : [];

    const hasRequiredRole = requiredRoles.some((role) =>
      userRoles.some(
        (userRole: unknown) =>
          typeof userRole === 'string' && userRole === role,
      ),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}