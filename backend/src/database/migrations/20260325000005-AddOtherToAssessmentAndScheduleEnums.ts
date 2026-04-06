import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOtherToAssessmentAndScheduleEnums20260325000005 implements MigrationInterface {
  name = 'AddOtherToAssessmentAndScheduleEnums20260325000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `assessments` MODIFY COLUMN `type` enum('exam','quiz','assignment','project','other') NOT NULL",
    );
    await queryRunner.query(
      "ALTER TABLE `assessments` MODIFY COLUMN `source` enum('classroom','direct','notice','other') NOT NULL DEFAULT 'classroom'",
    );
    await queryRunner.query(
      "ALTER TABLE `schedule_items` MODIFY COLUMN `type` enum('lecture','lab','exam','other') NOT NULL DEFAULT 'lecture'",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `assessments` SET `type` = 'assignment' WHERE `type` = 'other'",
    );
    await queryRunner.query(
      "UPDATE `assessments` SET `source` = 'classroom' WHERE `source` = 'other'",
    );
    await queryRunner.query(
      "UPDATE `schedule_items` SET `type` = 'lecture' WHERE `type` = 'other'",
    );

    await queryRunner.query(
      "ALTER TABLE `assessments` MODIFY COLUMN `type` enum('exam','quiz','assignment','project') NOT NULL",
    );
    await queryRunner.query(
      "ALTER TABLE `assessments` MODIFY COLUMN `source` enum('classroom','direct','notice') NOT NULL DEFAULT 'classroom'",
    );
    await queryRunner.query(
      "ALTER TABLE `schedule_items` MODIFY COLUMN `type` enum('lecture','lab','exam') NOT NULL DEFAULT 'lecture'",
    );
  }
}
