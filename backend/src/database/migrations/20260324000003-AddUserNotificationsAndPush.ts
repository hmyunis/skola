import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNotificationsAndPush20260324000003
  implements MigrationInterface
{
  name = 'AddUserNotificationsAndPush20260324000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasPreferencesColumn = await queryRunner.hasColumn(
      'users',
      'notificationPreferences',
    );
    if (!hasPreferencesColumn) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD COLUMN `notificationPreferences` text NULL AFTER `themeSettings`',
      );
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`in_app_notifications\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`classroomId\` varchar(36) NULL,
        \`kind\` varchar(32) NOT NULL DEFAULT 'announcement',
        \`title\` varchar(180) NOT NULL,
        \`body\` text NOT NULL,
        \`payload\` text NULL,
        \`isRead\` tinyint(1) NOT NULL DEFAULT 0,
        \`readAt\` datetime NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_in_app_notifications_user_createdAt\` (\`userId\`, \`createdAt\`),
        INDEX \`IDX_in_app_notifications_user_isRead\` (\`userId\`, \`isRead\`),
        CONSTRAINT \`FK_in_app_notifications_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_in_app_notifications_classroom\` FOREIGN KEY (\`classroomId\`) REFERENCES \`classrooms\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`web_push_subscriptions\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`endpoint\` varchar(512) NOT NULL,
        \`p256dh\` varchar(255) NOT NULL,
        \`auth\` varchar(255) NOT NULL,
        \`expirationTime\` bigint NULL,
        \`userAgent\` varchar(255) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_web_push_subscriptions_endpoint\` (\`endpoint\`),
        INDEX \`IDX_web_push_subscriptions_user_createdAt\` (\`userId\`, \`createdAt\`),
        CONSTRAINT \`FK_web_push_subscriptions_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `web_push_subscriptions`');
    await queryRunner.query('DROP TABLE IF EXISTS `in_app_notifications`');

    const hasPreferencesColumn = await queryRunner.hasColumn(
      'users',
      'notificationPreferences',
    );
    if (hasPreferencesColumn) {
      await queryRunner.query(
        'ALTER TABLE `users` DROP COLUMN `notificationPreferences`',
      );
    }
  }
}
