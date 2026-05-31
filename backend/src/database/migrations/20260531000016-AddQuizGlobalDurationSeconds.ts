import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuizGlobalDurationSeconds20260531000016
  implements MigrationInterface
{
  name = 'AddQuizGlobalDurationSeconds20260531000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `quizzes` ADD `globalDurationSeconds` int NULL AFTER `timeLimitMinutes`',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `quizzes` DROP COLUMN `globalDurationSeconds`',
    );
  }
}
