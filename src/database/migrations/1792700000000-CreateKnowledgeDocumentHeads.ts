import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeDocumentHeads1792700000000 implements MigrationInterface {
  name = 'CreateKnowledgeDocumentHeads1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`knowledge_document_heads\` (
        \`document_id\` char(36) NOT NULL,
        \`latest_version\` int unsigned NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`document_id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      INSERT INTO \`knowledge_document_heads\`
        (\`document_id\`, \`latest_version\`, \`created_at\`, \`updated_at\`)
      SELECT \`document_id\`, MAX(\`version\`), MIN(\`created_at\`), MAX(\`updated_at\`)
      FROM \`knowledge_documents\`
      GROUP BY \`document_id\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `knowledge_document_heads`');
  }
}
