import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignmentSupportFields1792000000000
  implements MigrationInterface
{
  name = 'AddAssignmentSupportFields1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` ADD `is_available` tinyint NOT NULL DEFAULT 1',
    );
    await queryRunner.query(
      'ALTER TABLE `users` ADD `support_categories` varchar(500) NULL',
    );

    await queryRunner.query(
      'ALTER TABLE `service_requests` ADD `assigned_to_user_id` int NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `service_requests` ADD `assigned_at` datetime NULL',
    );
    await queryRunner.query(
      'CREATE INDEX `IDX_service_requests_assignee_status` ON `service_requests` (`assigned_to_user_id`, `status`)',
    );
    await queryRunner.query(
      'ALTER TABLE `service_requests` ADD CONSTRAINT `FK_service_requests_assignee` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `service_requests` DROP FOREIGN KEY `FK_service_requests_assignee`',
    );
    await queryRunner.query(
      'DROP INDEX `IDX_service_requests_assignee_status` ON `service_requests`',
    );
    await queryRunner.query(
      'ALTER TABLE `service_requests` DROP COLUMN `assigned_at`',
    );
    await queryRunner.query(
      'ALTER TABLE `service_requests` DROP COLUMN `assigned_to_user_id`',
    );
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `support_categories`',
    );
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `is_available`',
    );
  }
}
