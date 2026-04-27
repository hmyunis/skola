import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuizQuestionExplanation20260427000014
  implements MigrationInterface
{
  name = 'AddQuizQuestionExplanation20260427000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `quiz_questions` ADD `explanation` text NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `quiz_questions` DROP COLUMN `explanation`',
    );
  }
}
