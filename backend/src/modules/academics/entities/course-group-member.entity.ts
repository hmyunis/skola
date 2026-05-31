import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { CourseGroup } from './course-group.entity';
import { User } from '../../users/entities/user.entity';

export enum CourseGroupMemberStatus {
  INVITED = 'invited',
  JOINED = 'joined',
  REJECTED = 'rejected',
}

export enum CourseGroupMemberRole {
  LEADER = 'leader',
  MEMBER = 'member',
}

@Entity('course_group_members')
@Unique(['groupId', 'userId'])
export class CourseGroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CourseGroup, (group) => group.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'groupId' })
  group: CourseGroup;

  @Column()
  groupId: string;

  @Column({ type: 'uuid' })
  classroomId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: CourseGroupMemberStatus,
    default: CourseGroupMemberStatus.JOINED,
  })
  status: CourseGroupMemberStatus;

  @Column({
    type: 'enum',
    enum: CourseGroupMemberRole,
    default: CourseGroupMemberRole.MEMBER,
  })
  role: CourseGroupMemberRole;

  @Column({ type: 'boolean', default: false })
  hideIdentity: boolean;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invitedById' })
  invitedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  invitedById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
