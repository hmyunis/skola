import { MigrationInterface, QueryRunner } from 'typeorm';

export class IsolateClassroomMemberState20260403000007
  implements MigrationInterface
{
  name = 'IsolateClassroomMemberState20260403000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `classroom_members` ADD `status` enum ('active','suspended','banned') NOT NULL DEFAULT 'active'",
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` ADD `suspendedUntil` timestamp NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` ADD `themeSettings` text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` ADD `notificationPreferences` text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` ADD `usePersonalImgBbApiKey` tinyint NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` ADD `imgbbApiKeyCiphertext` text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` ADD `imgbbApiKeyHint` varchar(8) NULL',
    );

    // Backfill per-class member state from legacy global user fields to keep behavior stable.
    await queryRunner.query(`
      UPDATE \`classroom_members\` cm
      INNER JOIN \`users\` u ON u.id = cm.userId
      SET
        cm.status = CASE
          WHEN u.isBanned = 1 THEN 'banned'
          WHEN u.suspendedUntil IS NOT NULL AND u.suspendedUntil > NOW() THEN 'suspended'
          ELSE 'active'
        END,
        cm.suspendedUntil = CASE
          WHEN u.isBanned = 1 THEN NULL
          WHEN u.suspendedUntil IS NOT NULL AND u.suspendedUntil > NOW() THEN u.suspendedUntil
          ELSE NULL
        END,
        cm.themeSettings = u.themeSettings,
        cm.notificationPreferences = u.notificationPreferences,
        cm.usePersonalImgBbApiKey = IFNULL(u.usePersonalImgBbApiKey, 0),
        cm.imgbbApiKeyCiphertext = u.imgbbApiKeyCiphertext,
        cm.imgbbApiKeyHint = u.imgbbApiKeyHint
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `classroom_members` DROP COLUMN `imgbbApiKeyHint`',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` DROP COLUMN `imgbbApiKeyCiphertext`',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` DROP COLUMN `usePersonalImgBbApiKey`',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` DROP COLUMN `notificationPreferences`',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` DROP COLUMN `themeSettings`',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` DROP COLUMN `suspendedUntil`',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` DROP COLUMN `status`',
    );
  }
}
