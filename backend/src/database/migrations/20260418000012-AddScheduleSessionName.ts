import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScheduleSessionName20260418000012
  implements MigrationInterface
{
  name = 'AddScheduleSessionName20260418000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `schedule_items` ADD `sessionName` varchar(180) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `schedule_items` DROP COLUMN `sessionName`',
    );
  }
}

