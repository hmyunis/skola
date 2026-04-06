import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleFireMode20260406000010 implements MigrationInterface {
  name = 'AddScheduleFireMode20260406000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `schedule_items` ADD `fireMode` enum('auto','on','off') NOT NULL DEFAULT 'auto'",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `schedule_items` DROP COLUMN `fireMode`',
    );
  }
}
