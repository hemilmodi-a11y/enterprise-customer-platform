import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateServiceRequests1791570000000 implements MigrationInterface {
  name = 'CreateServiceRequests1791570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`service_requests\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`customer_id\` int NOT NULL,
        \`service_id\` int NOT NULL,
        \`description\` text NOT NULL,
        \`status\` enum('Submitted', 'Assigned', 'In Progress', 'Pending Customer', 'Resolved', 'Closed') NOT NULL DEFAULT 'Submitted',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_service_requests_customer_status\` (\`customer_id\`, \`status\`),
        INDEX \`IDX_service_requests_service_status\` (\`service_id\`, \`status\`),
        INDEX \`IDX_service_requests_created_at\` (\`created_at\`),
        CONSTRAINT \`FK_service_requests_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`FK_service_requests_service\` FOREIGN KEY (\`service_id\`) REFERENCES \`services\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `service_requests` DROP FOREIGN KEY `FK_service_requests_service`',
    );
    await queryRunner.query(
      'ALTER TABLE `service_requests` DROP FOREIGN KEY `FK_service_requests_customer`',
    );
    await queryRunner.query(
      'DROP INDEX `IDX_service_requests_created_at` ON `service_requests`',
    );
    await queryRunner.query(
      'DROP INDEX `IDX_service_requests_service_status` ON `service_requests`',
    );
    await queryRunner.query(
      'DROP INDEX `IDX_service_requests_customer_status` ON `service_requests`',
    );
    await queryRunner.query('DROP TABLE `service_requests`');
  }
}
