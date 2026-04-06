import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoungePostImageUrl20260324000001 implements MigrationInterface {
  name = 'AddLoungePostImageUrl20260324000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasImageUrlColumn = await queryRunner.hasColumn(
      'lounge_posts',
      'imageUrl',
    );
    if (!hasImageUrlColumn) {
      await queryRunner.query(
        'ALTER TABLE `lounge_posts` ADD COLUMN `imageUrl` varchar(2048) NULL AFTER `content`',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasImageUrlColumn = await queryRunner.hasColumn(
      'lounge_posts',
      'imageUrl',
    );
    if (hasImageUrlColumn) {
      await queryRunner.query(
        'ALTER TABLE `lounge_posts` DROP COLUMN `imageUrl`',
      );
    }
  }
}
