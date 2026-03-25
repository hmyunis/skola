import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoungePostEditedAt20260325000004
  implements MigrationInterface
{
  name = 'AddLoungePostEditedAt20260325000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasEditedAt = await queryRunner.hasColumn('lounge_posts', 'editedAt');
    if (!hasEditedAt) {
      await queryRunner.query(
        'ALTER TABLE `lounge_posts` ADD COLUMN `editedAt` datetime NULL AFTER `createdAt`',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasEditedAt = await queryRunner.hasColumn('lounge_posts', 'editedAt');
    if (hasEditedAt) {
      await queryRunner.query(
        'ALTER TABLE `lounge_posts` DROP COLUMN `editedAt`',
      );
    }
  }
}
