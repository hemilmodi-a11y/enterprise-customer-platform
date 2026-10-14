import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceRequestPriorityAndAgentIndex1792200000000
  implements MigrationInterface
{
  name = 'AddServiceRequestPriorityAndAgentIndex1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`service_requests\`
      ADD \`priority\` enum('Low', 'Normal', 'High', 'Urgent')
      NOT NULL DEFAULT 'Normal'
    `);
    await queryRunner.query(`
      CREATE INDEX \`IDX_service_requests_agent_priority_status_created\`
      ON \`service_requests\`
      (\`assigned_to_user_id\`, \`priority\`, \`status\`, \`created_at\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX `IDX_service_requests_agent_priority_status_created` ON `service_requests`',
    );
    await queryRunner.query(
      'ALTER TABLE `service_requests` DROP COLUMN `priority`',
    );
  }
}
