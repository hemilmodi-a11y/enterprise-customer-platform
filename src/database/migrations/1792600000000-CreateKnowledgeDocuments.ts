import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeDocuments1792600000000 implements MigrationInterface {
  name = 'CreateKnowledgeDocuments1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`knowledge_documents\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`document_id\` char(36) NOT NULL,
        \`version\` int unsigned NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`description\` text NULL,
        \`category\` varchar(50) NOT NULL,
        \`department\` varchar(100) NOT NULL,
        \`access_level\` varchar(20) NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'DRAFT',
        \`mime_type\` varchar(100) NOT NULL,
        \`file_name\` varchar(255) NULL,
        \`storage_key\` varchar(512) NULL,
        \`content\` mediumtext NOT NULL,
        \`created_by_user_id\` int NOT NULL,
        \`updated_by_user_id\` int NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_knowledge_documents_document_version\` (\`document_id\`, \`version\`),
        INDEX \`IDX_knowledge_documents_category_status\` (\`category\`, \`status\`),
        INDEX \`IDX_knowledge_documents_department_status\` (\`department\`, \`status\`),
        INDEX \`IDX_knowledge_documents_access_status\` (\`access_level\`, \`status\`),
        CONSTRAINT \`FK_knowledge_documents_created_by\` FOREIGN KEY (\`created_by_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`FK_knowledge_documents_updated_by\` FOREIGN KEY (\`updated_by_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `knowledge_documents`');
  }
}
