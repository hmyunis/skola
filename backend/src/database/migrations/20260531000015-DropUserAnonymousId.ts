import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUserAnonymousId20260531000015 implements MigrationInterface {
  name = 'DropUserAnonymousId20260531000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    const anonymousIdColumn = table?.findColumnByName('anonymousId');

    if (anonymousIdColumn) {
      const anonymousIdUnique = table?.uniques.find((unique) =>
        unique.columnNames.includes('anonymousId'),
      );
      if (anonymousIdUnique) {
        await queryRunner.dropUniqueConstraint('users', anonymousIdUnique);
      }

      const anonymousIdIndex = table?.indices.find(
        (index) => index.isUnique && index.columnNames.includes('anonymousId'),
      );
      if (anonymousIdIndex) {
        await queryRunner.dropIndex('users', anonymousIdIndex);
      }

      await queryRunner.dropColumn('users', anonymousIdColumn);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    const anonymousIdColumn = table?.findColumnByName('anonymousId');

    if (!anonymousIdColumn) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD `anonymousId` varchar(255) NULL',
      );
      await queryRunner.query(
        'ALTER TABLE `users` ADD UNIQUE INDEX `IDX_users_anonymousId` (`anonymousId`)',
      );
    }
  }
}
