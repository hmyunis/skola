import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleConfirmationFields20260406000009 implements MigrationInterface {
  name = 'AddScheduleConfirmationFields20260406000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `schedule_items` ADD `confirmedAt` datetime NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `schedule_items` ADD `confirmedById` char(36) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `schedule_items` DROP COLUMN `confirmedById`',
    );
    await queryRunner.query(
      'ALTER TABLE `schedule_items` DROP COLUMN `confirmedAt`',
    );
  }
}
