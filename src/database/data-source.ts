import 'dotenv/config';
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
  ],

  migrations: ['src/database/migrations/*.ts'],
});
