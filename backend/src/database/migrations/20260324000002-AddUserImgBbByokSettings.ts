import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserImgBbByokSettings20260324000002 implements MigrationInterface {
  name = 'AddUserImgBbByokSettings20260324000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasUsePersonalColumn = await queryRunner.hasColumn(
      'users',
      'usePersonalImgBbApiKey',
    );
    if (!hasUsePersonalColumn) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `usePersonalImgBbApiKey` tinyint(1) NOT NULL DEFAULT 0 AFTER `themeSettings`',
      );
    }

    const hasCipherColumn = await queryRunner.hasColumn(
      'users',
      'imgbbApiKeyCiphertext',
    );
    if (!hasCipherColumn) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `imgbbApiKeyCiphertext` text NULL AFTER `usePersonalImgBbApiKey`',
      );
    }

    const hasHintColumn = await queryRunner.hasColumn(
      'users',
      'imgbbApiKeyHint',
    );
    if (!hasHintColumn) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `imgbbApiKeyHint` varchar(8) NULL AFTER `imgbbApiKeyCiphertext`',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasHintColumn = await queryRunner.hasColumn(
      'users',
      'imgbbApiKeyHint',
    );
    if (hasHintColumn) {
      await queryRunner.query(
        'ALTER TABLE `users` DROP COLUMN `imgbbApiKeyHint`',
      );
    }

    const hasCipherColumn = await queryRunner.hasColumn(
      'users',
      'imgbbApiKeyCiphertext',
    );
    if (hasCipherColumn) {
      await queryRunner.query(
        'ALTER TABLE `users` DROP COLUMN `imgbbApiKeyCiphertext`',
      );
    }

    const hasUsePersonalColumn = await queryRunner.hasColumn(
      'users',
      'usePersonalImgBbApiKey',
    );
    if (hasUsePersonalColumn) {
      await queryRunner.query(
        'ALTER TABLE `users` DROP COLUMN `usePersonalImgBbApiKey`',
      );
    }
  }
}
