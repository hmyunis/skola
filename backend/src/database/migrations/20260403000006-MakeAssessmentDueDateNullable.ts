import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeAssessmentDueDateNullable20260403000006
  implements MigrationInterface
{
  name = 'MakeAssessmentDueDateNullable20260403000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `assessments` MODIFY COLUMN `dueDate` date NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `assessments` SET `dueDate` = CURDATE() WHERE `dueDate` IS NULL",
    );
    await queryRunner.query(
      'ALTER TABLE `assessments` MODIFY COLUMN `dueDate` date NOT NULL',
    );
  }
}

