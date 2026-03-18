import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuizMaxAttempts20260318000000 implements MigrationInterface {
  name = 'AddQuizMaxAttempts20260318000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('quizzes', 'maxAttempts');
    if (!hasColumn) {
      await queryRunner.query(
        'ALTER TABLE `quizzes` ADD COLUMN `maxAttempts` INT NOT NULL DEFAULT 2 AFTER `isAnonymous`',
      );
    }

    await queryRunner.query(
      'UPDATE `quizzes` SET `maxAttempts` = 2 WHERE `maxAttempts` IS NULL OR `maxAttempts` < 1',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('quizzes', 'maxAttempts');
    if (hasColumn) {
      await queryRunner.query('ALTER TABLE `quizzes` DROP COLUMN `maxAttempts`');
    }
  }
}
