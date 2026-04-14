import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnnouncementTelegramPostMetadata20260414000011
  implements MigrationInterface
{
  name = 'AddAnnouncementTelegramPostMetadata20260414000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `announcements` ADD `telegramChatId` varchar(64) NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `announcements` ADD `telegramMessageId` int NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `announcements` DROP COLUMN `telegramMessageId`',
    );
    await queryRunner.query(
      'ALTER TABLE `announcements` DROP COLUMN `telegramChatId`',
    );
  }
}
