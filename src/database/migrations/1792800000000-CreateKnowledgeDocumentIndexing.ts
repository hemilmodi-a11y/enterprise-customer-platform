import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeDocumentIndexing1792800000000 implements MigrationInterface {
  name = 'CreateKnowledgeDocumentIndexing1792800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`knowledge_document_indexing\` (
        \`document_id\` char(36) NOT NULL,
        \`version\` int unsigned NOT NULL,
        \`status\` varchar(20) NOT NULL,
        \`chunk_count\` int unsigned NOT NULL DEFAULT 0,
        \`error_code\` varchar(50) NULL,
        \`indexed_at\` datetime(6) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`document_id\`),
        INDEX \`IDX_knowledge_document_indexing_status\` (\`status\`, \`updated_at\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `knowledge_document_indexing`');
  }
}
