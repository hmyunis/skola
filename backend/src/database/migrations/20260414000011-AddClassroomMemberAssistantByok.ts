import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClassroomMemberAssistantByok20260414000011
  implements MigrationInterface
{
  name = 'AddClassroomMemberAssistantByok20260414000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `classroom_members` ADD `usePersonalOpenAIApiKey` tinyint NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` ADD `openAIApiKeyCiphertext` text NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` ADD `openAIApiKeyHint` varchar(8) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `classroom_members` DROP COLUMN `openAIApiKeyHint`',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` DROP COLUMN `openAIApiKeyCiphertext`',
    );
    await queryRunner.query(
      'ALTER TABLE `classroom_members` DROP COLUMN `usePersonalOpenAIApiKey`',
    );
  }
}
