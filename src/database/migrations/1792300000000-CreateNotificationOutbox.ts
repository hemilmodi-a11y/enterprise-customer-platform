import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationOutbox1792300000000 implements MigrationInterface {
  name = 'CreateNotificationOutbox1792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`notification_outbox\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`event_key\` varchar(191) NOT NULL,
        \`payload\` json NOT NULL,
        \`attempts\` int unsigned NOT NULL DEFAULT 0,
        \`next_attempt_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`last_error\` varchar(100) NULL,
        \`processed_at\` datetime(6) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_notification_outbox_event_key\` (\`event_key\`),
        INDEX \`IDX_notification_outbox_pending\` (\`processed_at\`, \`next_attempt_at\`, \`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `notification_outbox`');
  }
}
