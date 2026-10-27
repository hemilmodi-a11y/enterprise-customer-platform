import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { PasswordResetToken } from '../auth/password-reset-token.entity';
import { Customer } from '../customers/customer.entity';
import { ServiceRequest } from '../requests/service-request.entity';
import { CatalogService } from '../services/catalog-service.entity';
import { ServiceRequestSyncOutbox } from '../mongodb/service-request-sync-outbox.entity';
import { NotificationOutbox } from '../notifications/notification-outbox.entity';
import { ServiceRequestAttachment } from '../requests/request-attachment.entity';

export default new DataSource({
  type: 'mysql',

  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  entities: [
    User,
    Role,
    UserRole,
    RefreshToken,
    PasswordResetToken,
    Customer,
    CatalogService,
    ServiceRequest,
    ServiceRequestSyncOutbox,
    NotificationOutbox,
    ServiceRequestAttachment,
  ],

  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
});
