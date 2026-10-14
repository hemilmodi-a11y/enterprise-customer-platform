import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceRequestSyncOutbox1792100000000
  implements MigrationInterface
{
  name = 'AddServiceRequestSyncOutbox1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`service_request_sync_outbox\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`aggregate_type\` enum('request', 'service') NOT NULL,
        \`aggregate_id\` int unsigned NOT NULL,
        \`attempts\` int unsigned NOT NULL DEFAULT 0,
        \`next_attempt_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`last_error\` varchar(100) NULL,
        \`processed_at\` datetime(6) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_service_request_sync_outbox_pending\` (\`processed_at\`, \`next_attempt_at\`, \`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      INSERT INTO \`service_request_sync_outbox\`
        (\`aggregate_type\`, \`aggregate_id\`)
      SELECT 'request', \`id\` FROM \`service_requests\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `service_request_sync_outbox`');
  }
}
