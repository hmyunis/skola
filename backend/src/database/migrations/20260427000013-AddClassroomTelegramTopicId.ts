import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClassroomTelegramTopicId20260427000013
  implements MigrationInterface
{
  name = 'AddClassroomTelegramTopicId20260427000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `classrooms` ADD `telegramTopicId` int UNSIGNED NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `classrooms` DROP COLUMN `telegramTopicId`',
    );
  }
}
