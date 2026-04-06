import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDeletedAt20260404000008 implements MigrationInterface {
  name = 'AddUserDeletedAt20260404000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` ADD `deletedAt` timestamp NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `users` DROP COLUMN `deletedAt`');
  }
}
