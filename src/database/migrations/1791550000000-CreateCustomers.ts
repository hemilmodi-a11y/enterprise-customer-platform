import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomers1791550000000 implements MigrationInterface {
  name = 'CreateCustomers1791550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`customers\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`user_id\` int NOT NULL,
        \`phone\` varchar(30) NULL,
        \`company_name\` varchar(150) NULL,
        \`address\` varchar(500) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`REL_11d81cd7be87b6f8865b0cf766\` (\`user_id\`),
        INDEX \`IDX_customers_company_name\` (\`company_name\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      ALTER TABLE \`customers\`
      ADD CONSTRAINT \`FK_11d81cd7be87b6f8865b0cf7661\`
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`)
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO \`roles\` (\`name\`, \`description\`)
      VALUES ('Customer', 'Customer account')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `customers` DROP FOREIGN KEY `FK_11d81cd7be87b6f8865b0cf7661`',
    );
    await queryRunner.query(
      'DROP INDEX `IDX_customers_company_name` ON `customers`',
    );
    await queryRunner.query(
      'DROP INDEX `REL_11d81cd7be87b6f8865b0cf766` ON `customers`',
    );
    await queryRunner.query('DROP TABLE `customers`');
    // Keep the Customer role: it may predate this migration or be assigned to accounts.
  }
}
