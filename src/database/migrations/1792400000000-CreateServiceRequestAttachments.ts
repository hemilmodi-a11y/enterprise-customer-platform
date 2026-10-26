import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateServiceRequestAttachments1792400000000 implements MigrationInterface {
  name = 'CreateServiceRequestAttachments1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`service_request_attachments\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`service_request_id\` int NOT NULL,
        \`uploaded_by_user_id\` int NOT NULL,
        \`original_file_name\` varchar(255) NOT NULL,
        \`content_type\` varchar(100) NOT NULL,
        \`size_bytes\` int unsigned NOT NULL,
        \`storage_key\` varchar(512) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_service_request_attachments_storage_key\` (\`storage_key\`),
        INDEX \`IDX_service_request_attachments_request_created\` (\`service_request_id\`, \`created_at\`),
        CONSTRAINT \`FK_service_request_attachments_request\` FOREIGN KEY (\`service_request_id\`) REFERENCES \`service_requests\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`FK_service_request_attachments_uploader\` FOREIGN KEY (\`uploaded_by_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `service_request_attachments`');
  }
}
