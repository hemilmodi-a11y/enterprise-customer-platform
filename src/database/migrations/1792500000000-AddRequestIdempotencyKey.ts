import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequestIdempotencyKey1792500000000 implements MigrationInterface {
  name = 'AddRequestIdempotencyKey1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`service_requests\`
      ADD \`idempotency_key\` varchar(128) NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX \`UQ_service_requests_customer_idempotency_key\`
      ON \`service_requests\` (\`customer_id\`, \`idempotency_key\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX \`UQ_service_requests_customer_idempotency_key\`
      ON \`service_requests\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`service_requests\`
      DROP COLUMN \`idempotency_key\`
    `);
  }
}
