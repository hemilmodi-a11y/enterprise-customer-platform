import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateServices1791560000000 implements MigrationInterface {
  name = 'CreateServices1791560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`services\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`name\` varchar(150) NOT NULL,
        \`description\` text NOT NULL,
        \`category\` varchar(100) NOT NULL,
        \`status\` enum('active', 'inactive') NOT NULL DEFAULT 'active',
        \`sla_minutes\` int unsigned NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_services_name\` (\`name\`),
        INDEX \`IDX_services_category_status\` (\`category\`, \`status\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX `IDX_services_category_status` ON `services`',
    );
    await queryRunner.query('DROP INDEX `IDX_services_name` ON `services`');
    await queryRunner.query('DROP TABLE `services`');
  }
}
