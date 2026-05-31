import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourseGroups20260531000017 implements MigrationInterface {
  name = 'AddCourseGroups20260531000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`course_group_formations\` (
        \`id\` varchar(36) NOT NULL,
        \`courseId\` varchar(36) NOT NULL,
        \`classroomId\` varchar(36) NOT NULL,
        \`maxMembers\` int NOT NULL DEFAULT 4,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdById\` varchar(36) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_course_group_formations_courseId\` (\`courseId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`course_groups\` (
        \`id\` varchar(36) NOT NULL,
        \`formationId\` varchar(36) NOT NULL,
        \`classroomId\` varchar(36) NOT NULL,
        \`name\` varchar(80) NOT NULL,
        \`createdById\` varchar(36) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`course_group_members\` (
        \`id\` varchar(36) NOT NULL,
        \`groupId\` varchar(36) NOT NULL,
        \`classroomId\` varchar(36) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`status\` enum ('invited', 'joined', 'rejected') NOT NULL DEFAULT 'joined',
        \`role\` enum ('leader', 'member') NOT NULL DEFAULT 'member',
        \`hideIdentity\` tinyint NOT NULL DEFAULT 0,
        \`invitedById\` varchar(36) NULL,
        \`respondedAt\` timestamp NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_course_group_members_group_user\` (\`groupId\`, \`userId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(
      'ALTER TABLE `course_group_formations` ADD CONSTRAINT `FK_course_group_formations_course` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `course_group_formations` ADD CONSTRAINT `FK_course_group_formations_created_by` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `course_groups` ADD CONSTRAINT `FK_course_groups_formation` FOREIGN KEY (`formationId`) REFERENCES `course_group_formations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `course_groups` ADD CONSTRAINT `FK_course_groups_created_by` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `course_group_members` ADD CONSTRAINT `FK_course_group_members_group` FOREIGN KEY (`groupId`) REFERENCES `course_groups`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `course_group_members` ADD CONSTRAINT `FK_course_group_members_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `course_group_members` ADD CONSTRAINT `FK_course_group_members_invited_by` FOREIGN KEY (`invitedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `course_group_members` DROP FOREIGN KEY `FK_course_group_members_invited_by`',
    );
    await queryRunner.query(
      'ALTER TABLE `course_group_members` DROP FOREIGN KEY `FK_course_group_members_user`',
    );
    await queryRunner.query(
      'ALTER TABLE `course_group_members` DROP FOREIGN KEY `FK_course_group_members_group`',
    );
    await queryRunner.query(
      'ALTER TABLE `course_groups` DROP FOREIGN KEY `FK_course_groups_created_by`',
    );
    await queryRunner.query(
      'ALTER TABLE `course_groups` DROP FOREIGN KEY `FK_course_groups_formation`',
    );
    await queryRunner.query(
      'ALTER TABLE `course_group_formations` DROP FOREIGN KEY `FK_course_group_formations_created_by`',
    );
    await queryRunner.query(
      'ALTER TABLE `course_group_formations` DROP FOREIGN KEY `FK_course_group_formations_course`',
    );
    await queryRunner.query('DROP TABLE `course_group_members`');
    await queryRunner.query('DROP TABLE `course_groups`');
    await queryRunner.query('DROP TABLE `course_group_formations`');
  }
}
