import 'dotenv/config';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';

export default new DataSource({
  type: 'mysql',

  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),

  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  entities: [User, Role, UserRole],

  migrations: ['src/database/migrations/*.ts'],

  synchronize: false,
});