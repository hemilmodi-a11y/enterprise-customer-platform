import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiTicketClassification1792900000000 implements MigrationInterface {
  name = 'AddAiTicketClassification1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`service_requests\`
      ADD \`ai_classification_category\` enum(
        'BILLING',
        'TECHNICAL',
        'ACCOUNT',
        'PRODUCT',
        'SECURITY',
        'COMPLAINT',
        'GENERAL'
      ) NULL,
      ADD \`ai_suggested_priority\` enum(
        'Low',
        'Normal',
        'High',
        'Urgent'
      ) NULL,
      ADD \`ai_classification_confidence\` decimal(4,3) NULL,
      ADD \`ai_classification_reason\` varchar(500) NULL,
      ADD \`ai_classification_status\` enum(
        'PENDING',
        'COMPLETED',
        'FAILED',
        'DISABLED'
      ) NOT NULL DEFAULT 'DISABLED',
      ADD \`ai_classified_at\` datetime NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`service_requests\`
      DROP COLUMN \`ai_classified_at\`,
      DROP COLUMN \`ai_classification_status\`,
      DROP COLUMN \`ai_classification_reason\`,
      DROP COLUMN \`ai_classification_confidence\`,
      DROP COLUMN \`ai_suggested_priority\`,
      DROP COLUMN \`ai_classification_category\`
    `);
  }
}
